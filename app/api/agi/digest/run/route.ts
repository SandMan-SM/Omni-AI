import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { sendOutreachEmail } from '@/lib/agi/resend';
import { todayPt, ptStartOfDayIso } from '@/lib/tz';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate end-of-day digest for a business: counts, hottest replies,
// AI-written summary, optionally email the user.
//
// Admin-or-cron gated. Each call is a Claude call + optionally a Resend
// email send to the operator. Without auth, a stranger could drain
// Claude budget and force daily-digest emails to the operator with junk
// data. The cron loop (cron/daily-digest) forwards CRON_SECRET so the
// scheduled run still passes.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, send_email } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    // "Today" anchored on the operator's PT calendar day — see lib/tz.
    const today = todayPt();
    const startISO = ptStartOfDayIso();

    // Pull today's metrics
    const [
      { data: business },
      { data: newLeads },
      { data: sentAssets },
      { data: openedAssets },
      { data: replies },
      { data: bookings },
      { data: wonDeals },
    ] = await Promise.all([
      supabase.from('omni_businesses').select('*').eq('id', business_id).single(),
      supabase.from('omni_leads_generated').select('id, first_name, last_name, company, score').eq('business_id', business_id).gte('created_at', startISO),
      supabase.from('omni_outreach_assets').select('id').eq('business_id', business_id).gte('sent_at', startISO),
      supabase.from('omni_outreach_assets').select('id').eq('business_id', business_id).gte('opened_at', startISO),
      supabase.from('omni_outreach_assets').select('id, reply_text, reply_category, reply_sentiment, lead:omni_leads_generated(first_name, last_name, company)').eq('business_id', business_id).gte('replied_at', startISO),
      supabase.from('omni_meeting_bookings').select('id, attendee_name').eq('business_id', business_id).gte('created_at', startISO),
      supabase.from('omni_leads_generated').select('id, first_name, last_name, company, deal_value').eq('business_id', business_id).eq('deal_stage', 'closed_won').gte('updated_at', startISO),
    ]);

    type ReplyRow = {
      id: string;
      reply_text: string | null;
      reply_category: string | null;
      reply_sentiment: string | null;
      lead: { first_name: string | null; last_name: string | null; company: string | null } | null;
    };

    const repliesArr = (replies ?? []) as unknown as ReplyRow[];

    const counts = {
      leads_added: newLeads?.length ?? 0,
      outreach_sent: sentAssets?.length ?? 0,
      opens: openedAssets?.length ?? 0,
      replies: repliesArr.length,
      meetings_booked: bookings?.length ?? 0,
      deals_won: wonDeals?.length ?? 0,
      revenue_won: (wonDeals ?? []).reduce((s, d) => s + (d.deal_value ?? 0), 0),
    };

    // Hottest replies = those with positive sentiment OR category=interested/meeting_booked
    const hottestReplies = repliesArr
      .filter(r => r.reply_sentiment === 'positive' || ['interested', 'meeting_booked', 'question'].includes(r.reply_category ?? ''))
      .map(r => ({
        name: [r.lead?.first_name, r.lead?.last_name].filter(Boolean).join(' '),
        company: r.lead?.company,
        category: r.reply_category,
        snippet: r.reply_text?.slice(0, 120),
      }));

    // Claude-written daily summary
    let aiSummary = `${counts.leads_added} new leads · ${counts.outreach_sent} sent · ${counts.replies} replies · ${counts.meetings_booked} booked.`;
    if (process.env.ANTHROPIC_API_KEY && (counts.outreach_sent > 0 || counts.replies > 0)) {
      try {
        const summaryPrompt = `Write a 2-sentence end-of-day status update for a sales rep.

TODAY:
- ${counts.leads_added} new leads added
- ${counts.outreach_sent} outreach emails sent
- ${counts.opens} opens
- ${counts.replies} replies
- ${counts.meetings_booked} meetings booked
- ${counts.deals_won} deals won (${(counts.revenue_won / 100).toFixed(0)} revenue)

${hottestReplies.length > 0 ? `Hot replies:\n${hottestReplies.slice(0, 3).map(r => `- ${r.name} @ ${r.company} (${r.category}): "${r.snippet}"`).join('\n')}` : 'No hot replies today.'}

Write 2 sentences max. Be specific. Mention names if hot replies exist. Highlight the top action for tomorrow.`;

        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: summaryPrompt }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') aiSummary = tb.text.trim();
      } catch { /* swallow */ }
    }

    // Upsert digest row
    const digestRow = {
      business_id,
      date: today,
      ...counts,
      hottest_replies: hottestReplies,
      ai_summary: aiSummary,
    };
    const { data: digest } = await supabase
      .from('omni_daily_digest')
      .upsert(digestRow, { onConflict: 'business_id,date' })
      .select()
      .single();

    // Optionally email
    let emailed = false;
    if (send_email && (business as { sender_email?: string })?.sender_email && process.env.RESEND_API_KEY) {
      const senderEmail = (business as unknown as { sender_email: string }).sender_email;
      const subj = `📊 ${business?.name} Daily Digest — ${today}`;
      const body = buildDigestEmail({ businessName: business?.name ?? 'Your business', counts, hottestReplies, aiSummary, today });
      await sendOutreachEmail({
        asset_id: 'system-daily-digest',
        to: senderEmail,
        subject: subj,
        body,
      }).catch(() => {});
      emailed = true;
      await supabase
        .from('omni_daily_digest')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', digest?.id);
    }

    return NextResponse.json({
      ok: true,
      digest: { ...digestRow, ai_summary: aiSummary },
      emailed,
    });
  } catch (err) {
    console.error('[digest/run]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

function buildDigestEmail(args: {
  businessName: string;
  counts: { leads_added: number; outreach_sent: number; opens: number; replies: number; meetings_booked: number; deals_won: number; revenue_won: number };
  hottestReplies: Array<{ name: string; company: string | null | undefined; category: string | null; snippet: string | undefined }>;
  aiSummary: string;
  today: string;
}): string {
  const { counts, hottestReplies, aiSummary, today } = args;
  const replyLines = hottestReplies.length > 0
    ? hottestReplies.slice(0, 5).map(r => `🔥 ${r.name} @ ${r.company} [${r.category}]\n   "${r.snippet}"`).join('\n\n')
    : '(no hot replies)';

  return `Daily Digest — ${today}

📊 SUMMARY
${aiSummary}

📈 NUMBERS
• Leads added: ${counts.leads_added}
• Outreach sent: ${counts.outreach_sent}
• Opens: ${counts.opens}
• Replies: ${counts.replies}
• Meetings booked: ${counts.meetings_booked}
• Deals won: ${counts.deals_won} ($${(counts.revenue_won / 100).toFixed(0)})

🎯 HOT REPLIES
${replyLines}

— Sent automatically by OmniLeads AGI`;
}
