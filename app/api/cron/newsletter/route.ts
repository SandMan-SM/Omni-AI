import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDailyNewsletter, runPremiumNewsletter } from '@/lib/newsletter-sender';

/**
 * Newsletter Cron — Called by Vercel Cron at 8:00 AM ET daily
 *
 * Every day: Sends FREE tier newsletter (trending keywords + intelligence brief)
 * Mon/Wed/Fri: Also sends PREMIUM tier newsletter (Value/Insight/Offer)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // 1. Always send the FREE daily newsletter
    const freeResult = await runDailyNewsletter(supabase as any);

    console.log(
      `[Newsletter Cron] FREE sent: ${freeResult.content.subject} | ` +
      `Telegram: ${freeResult.telegramOk} | Email: ${freeResult.emailOk} | Free subs: ${freeResult.freeSent}`
    );

    // 2. On Mon/Wed/Fri, also send PREMIUM newsletter
    const premiumResult = await runPremiumNewsletter(supabase as any);

    if (!premiumResult.skipped) {
      console.log(
        `[Newsletter Cron] PREMIUM sent: ${premiumResult.content?.subject} | ` +
        `Telegram: ${premiumResult.telegramOk} | Premium subs: ${premiumResult.premiumSent}`
      );
    } else {
      console.log(`[Newsletter Cron] Premium skipped: ${premiumResult.reason}`);
    }

    return NextResponse.json({
      success: true,
      free: {
        subject: freeResult.content.subject,
        telegram: freeResult.telegramOk,
        email: freeResult.emailOk,
        free_recipients: freeResult.freeSent,
        slug: freeResult.content.slug,
      },
      premium: premiumResult.skipped
        ? { skipped: true, reason: premiumResult.reason }
        : {
            subject: premiumResult.content?.subject,
            telegram: premiumResult.telegramOk,
            premium_recipients: premiumResult.premiumSent,
            day_type: premiumResult.content?.day_type,
          },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Newsletter Cron] Failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
