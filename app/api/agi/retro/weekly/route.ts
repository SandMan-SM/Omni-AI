import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { sendOutreachEmail } from '@/lib/agi/resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Weekly retro: Monday morning report covering last 7 days.
// AI-summarized: what worked, what didn't, what to focus on this week.
export async function POST(req: NextRequest) {
  try {
    const { business_id, send_email } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startISO = sevenDaysAgo.toISOString();

    const [{ data: business }, { data: leads }, { data: replies }, { data: bookings }, { data: won }] = await Promise.all([
      supabase.from('omni_businesses').select('*').eq('id', business_id).single(),
      supabase.from('omni_leads_generated').select('id, first_name, last_name, company, score, status, deal_stage, deal_value').eq('business_id', business_id).gte('created_at', startISO),
      supabase.from('omni_outreach_assets').select('id, reply_category, reply_sentiment, lead:omni_leads_generated(first_name, company)').eq('business_id', business_id).gte('replied_at', startISO),
      supabase.from('omni_meeting_bookings').select('id, attendee_name, start_at').eq('business_id', business_id).gte('created_at', startISO),
      supabase.from('omni_leads_generated').select('first_name, company, deal_value').eq('business_id', business_id).eq('deal_stage', 'closed_won').gte('updated_at', startISO),
    ]);

    const summary = {
      new_leads: leads?.length ?? 0,
      replies: replies?.length ?? 0,
      hot_replies: (replies ?? []).filter(r => r.reply_sentiment === 'positive' || ['interested', 'meeting_booked'].includes(r.reply_category ?? '')).length,
      bookings: bookings?.length ?? 0,
      deals_won: won?.length ?? 0,
      revenue_won: (won ?? []).reduce((s, w) => s + (w.deal_value ?? 0), 0),
    };

    let aiSummary = `Last 7 days: ${summary.new_leads} new leads, ${summary.replies} replies, ${summary.bookings} meetings booked, ${summary.deals_won} deals won.`;

    if (process.env.ANTHROPIC_API_KEY && summary.new_leads + summary.replies > 0) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Write a Monday morning weekly retro for a sales rep. Be specific, actionable, no fluff.

LAST 7 DAYS:
- ${summary.new_leads} new leads
- ${summary.replies} replies (${summary.hot_replies} hot)
- ${summary.bookings} meetings booked
- ${summary.deals_won} deals won ($${(summary.revenue_won / 100).toFixed(0)})

WON DEALS: ${(won ?? []).slice(0, 5).map(w => `${w.first_name} @ ${w.company} ($${(w.deal_value ?? 0)/100})`).join('; ') || 'none'}

HOT REPLIES: ${(replies ?? []).slice(0, 3).map(r => {
  type LeadJoin = { first_name?: string | null; company?: string | null };
  const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
  return `${(lead as LeadJoin)?.first_name ?? '?'} (${r.reply_category ?? '?'})`;
}).join('; ') || 'none'}

Format: 3 sections each 2 sentences max:
🏆 What worked
🚧 What needs attention
🎯 This week's focus`,
          }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') aiSummary = tb.text.trim();
      } catch { /* swallow */ }
    }

    const senderEmail = (business as { sender_email?: string })?.sender_email;
    let emailed = false;
    if (send_email && senderEmail && process.env.RESEND_API_KEY) {
      const body = `📊 Weekly Retro — ${business?.name}\n\n${aiSummary}\n\n📈 Numbers\n• New leads: ${summary.new_leads}\n• Replies: ${summary.replies} (${summary.hot_replies} hot)\n• Meetings: ${summary.bookings}\n• Deals won: ${summary.deals_won} ($${(summary.revenue_won / 100).toFixed(0)})\n\n— Sent automatically by OmniLeads AGI`;
      await sendOutreachEmail({
        asset_id: 'system-weekly-retro',
        to: senderEmail,
        subject: `📊 Weekly retro — ${business?.name} — ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}`,
        body,
      }).catch(() => {});
      emailed = true;
    }

    return NextResponse.json({ ok: true, summary, ai_summary: aiSummary, emailed });
  } catch (err) {
    console.error('[retro/weekly]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
