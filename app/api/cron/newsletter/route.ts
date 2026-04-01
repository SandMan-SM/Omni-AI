import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { runDailyNewsletter, runPremiumNewsletter, generateDrafts, sendMorningDebrief } from '@/lib/newsletter-sender';
import { logEvent } from '@/lib/events';

/**
 * Newsletter Cron — Called by Vercel Cron
 *
 * ?action=generate-drafts (8:00 AM ET): Generate draft newsletters without sending
 * Default (9:00 AM ET): Send FREE + PREMIUM newsletters, then send ONE clean Telegram debrief
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Draft generation is safe (no sends) — allow without secret for manual triggers
  // Sending still requires CRON_SECRET
  if (action !== 'generate-drafts') {
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = await createClient();

    // Draft generation mode — use service role key for DB writes
    if (action === 'generate-drafts') {
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const drafts = await generateDrafts(serviceSupabase as any);

      console.log(
        `[Newsletter Cron] Drafts generated: FREE="${drafts.free.subject}" | ` +
        `PREMIUM=${drafts.premium ? `"${drafts.premium.subject}"` : 'skipped (not Mon/Wed/Fri)'}`
      );

      return NextResponse.json({
        success: true,
        action: 'generate-drafts',
        drafts,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: send newsletters then send ONE clean debrief

    // Guard: check if we already sent today to prevent double-firing
    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    try {
      const { count } = await (supabase as any)
        .from('newsletter_sends')
        .select('id', { count: 'exact', head: true })
        .gte('sent_at', `${todayDate}T00:00:00.000Z`)
        .lte('sent_at', `${todayDate}T23:59:59.999Z`);

      if (count && count >= 1) {
        console.log(`[Newsletter Cron] Already sent ${count} newsletters today — skipping to prevent duplicates`);
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `Already sent ${count} newsletters today`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (guardErr) {
      console.error('[Newsletter Cron] Guard query failed — blocking send as safety measure:', guardErr);
      return NextResponse.json({
        success: false,
        error: 'Guard query failed — refusing to send without dedup check',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // 1. Send the FREE daily newsletter
    const freeResult = await runDailyNewsletter(supabase as any);

    console.log(
      `[Newsletter Cron] FREE sent: ${freeResult.content.subject} | ` +
      `Email: ${freeResult.emailOk} | Free subs: ${freeResult.freeSent}`
    );

    // 2. On Mon/Wed/Fri, also send PREMIUM newsletter
    const premiumResult = await runPremiumNewsletter(supabase as any);

    if (!premiumResult.skipped) {
      console.log(
        `[Newsletter Cron] PREMIUM sent: ${premiumResult.content?.subject} | ` +
        `Premium subs: ${premiumResult.premiumSent}`
      );
    } else {
      console.log(`[Newsletter Cron] Premium skipped: ${premiumResult.reason}`);
    }

    // 3. Gather debrief data — meetings today + recent fixes
    let meetingsToday = 0;
    const recentFixes: string[] = [];
    let insight = '';

    try {
      // Count today's meetings from demo_bookings
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { count } = await (supabase as any)
        .from('demo_bookings')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString());

      meetingsToday = count || 0;
    } catch {
      meetingsToday = 0;
    }

    try {
      // Pull recent system activity (fixes/features from last 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentActivity } = await (supabase as any)
        .from('activity_log')
        .select('subject, type')
        .in('type', ['feature', 'fix', 'improvement', 'deploy', 'system_health'])
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(6);

      if (recentActivity?.length) {
        for (const a of recentActivity) {
          recentFixes.push(a.subject);
        }
      }
    } catch {
      // No recent fixes — that's fine
    }

    // Generate an actionable insight from today's newsletter content
    const freeInsights = freeResult.content.insights || [];
    if (freeResult.content.power_move) {
      insight = freeResult.content.power_move;
    } else if (freeInsights.length > 0) {
      insight = freeInsights[0];
    }

    // 4. Send ONE clean Telegram debrief
    const debriefOk = await sendMorningDebrief({
      freeContent: freeResult.content,
      premiumContent: premiumResult.skipped ? null : (premiumResult.content || null),
      meetingsToday,
      recentFixes,
      insight,
    });

    console.log(`[Newsletter Cron] Debrief sent: ${debriefOk}`);

    // Log events for the newsletter run
    logEvent(supabase as any, {
      actor_type: 'cron',
      actor_id: 'newsletter_cron',
      event_type: 'newsletter_sent',
      event_category: 'newsletter',
      action: 'send',
      target_type: 'newsletter_post',
      target_id: freeResult.content.slug,
      value_numeric: freeResult.freeSent,
      value_text: freeResult.content.subject,
      properties: {
        tier: 'free',
        email_ok: freeResult.emailOk,
        debrief_ok: debriefOk,
      },
    });

    if (!premiumResult.skipped && premiumResult.content) {
      logEvent(supabase as any, {
        actor_type: 'cron',
        actor_id: 'newsletter_cron',
        event_type: 'newsletter_sent',
        event_category: 'newsletter',
        action: 'send',
        target_type: 'newsletter_post',
        target_id: premiumResult.content.slug,
        value_numeric: premiumResult.premiumSent,
        value_text: premiumResult.content.subject,
        properties: { tier: 'premium', day_type: premiumResult.content.day_type },
      });
    }

    logEvent(supabase as any, {
      actor_type: 'cron',
      actor_id: 'newsletter_cron',
      event_type: 'cron_executed',
      event_category: 'system',
      action: 'execute',
      value_text: 'newsletter_send',
    });

    return NextResponse.json({
      success: true,
      free: {
        subject: freeResult.content.subject,
        email: freeResult.emailOk,
        free_recipients: freeResult.freeSent,
        slug: freeResult.content.slug,
      },
      premium: premiumResult.skipped
        ? { skipped: true, reason: premiumResult.reason }
        : {
            subject: premiumResult.content?.subject,
            premium_recipients: premiumResult.premiumSent,
            day_type: premiumResult.content?.day_type,
          },
      debrief: debriefOk,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Newsletter Cron] Failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
