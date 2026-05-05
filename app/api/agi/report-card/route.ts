import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Monthly client deliverable: AI-written report card with grades + recommendations.
// Designed to be sent TO clients as a PDF/HTML deliverable.
export async function POST(req: NextRequest) {
  try {
    const { business_id, period_days } = await req.json() as { business_id: string; period_days?: number };
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    const days = period_days ?? 30;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);

    const [{ data: business }, { data: leads }, { data: replies }, { data: bookings }, { data: won }] = await Promise.all([
      supabase.from('omni_businesses').select('*').eq('id', business_id).single(),
      supabase.from('omni_leads_generated').select('*').eq('business_id', business_id).gte('created_at', cutoff.toISOString()),
      supabase.from('omni_outreach_assets').select('reply_category, reply_sentiment').eq('business_id', business_id).gte('replied_at', cutoff.toISOString()),
      supabase.from('omni_meeting_bookings').select('id').eq('business_id', business_id).gte('created_at', cutoff.toISOString()),
      supabase.from('omni_leads_generated').select('deal_value').eq('business_id', business_id).eq('deal_stage', 'closed_won').gte('updated_at', cutoff.toISOString()),
    ]);

    const m = {
      leads: leads?.length ?? 0,
      replies: replies?.length ?? 0,
      hot_replies: (replies ?? []).filter(r => r.reply_sentiment === 'positive' || ['interested', 'meeting_booked'].includes(r.reply_category ?? '')).length,
      bookings: bookings?.length ?? 0,
      deals_won: won?.length ?? 0,
      revenue: (won ?? []).reduce((s, w) => s + (w.deal_value ?? 0), 0),
    };

    // Compute simple grades
    const grade = (n: number, thresholds: [number, number, number]): string => {
      if (n >= thresholds[0]) return 'A';
      if (n >= thresholds[1]) return 'B';
      if (n >= thresholds[2]) return 'C';
      return 'D';
    };

    const grades = {
      lead_volume: grade(m.leads, [80, 40, 15]),
      engagement: grade(m.replies, [10, 5, 2]),
      conversion: grade(m.bookings, [5, 2, 1]),
      // m.revenue is the sum of deal_value (stored in cents) for closed-won
      // leads in the period. Thresholds: A ≥ $5k, B ≥ $1k, C ≥ $100. The
      // previous grade compared m.deals_won (a count) to [3,1,0.5] — 0.5
      // was dead because count >= 0.5 means count >= 1, collapsing C into B
      // and labeling the card "revenue" while actually grading deal count.
      revenue: grade(m.revenue, [500_000, 100_000, 10_000]),
    };

    let aiNarrative: string | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Write a monthly report card for ${business?.name} (${business?.industry}). Period: last ${days} days.

METRICS:
- New leads: ${m.leads}
- Replies received: ${m.replies} (${m.hot_replies} hot)
- Meetings booked: ${m.bookings}
- Deals won: ${m.deals_won} ($${(m.revenue / 100).toFixed(0)})

GRADES:
- Lead volume: ${grades.lead_volume}
- Engagement: ${grades.engagement}
- Conversion: ${grades.conversion}
- Revenue: ${grades.revenue}

Write a 4-paragraph executive summary. Be specific and direct:
1. The headline (was this a good month?)
2. What worked
3. What's stuck or needs attention
4. The 3 things to focus on next month

Tone: professional but conversational, like a trusted advisor.`,
          }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') aiNarrative = tb.text.trim();
      } catch { /* swallow */ }
    }

    return NextResponse.json({
      ok: true,
      period_days: days,
      business: { name: business?.name, industry: business?.industry },
      metrics: m,
      grades,
      ai_narrative: aiNarrative,
    });
  } catch (err) {
    console.error('[report-card]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
