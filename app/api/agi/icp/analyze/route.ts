import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ICP fingerprint analyzer: looks at won deals, identifies the patterns that
// distinguish winners from losers, and returns an "ideal customer profile" you can
// feed back into the campaign builder.
export async function POST(req: NextRequest) {
  try {
    const { business_id } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    // Pull won + lost leads (need both to find the delta)
    const { data: won } = await supabase
      .from('omni_leads_generated')
      .select('title, company, lead_location, score, deal_value, source')
      .eq('business_id', business_id)
      .eq('deal_stage', 'closed_won');

    const { data: lost } = await supabase
      .from('omni_leads_generated')
      .select('title, company, lead_location, score, deal_value, source')
      .eq('business_id', business_id)
      .eq('deal_stage', 'closed_lost');

    const wonArr = won ?? [];
    const lostArr = lost ?? [];

    if (wonArr.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No won deals yet. Need at least 3 closed-won deals to identify a fingerprint.',
      }, { status: 400 });
    }

    // Stats-based fingerprint (always works)
    const titleCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let totalRevenue = 0;
    let totalScore = 0;

    for (const w of wonArr) {
      if (w.title) titleCounts[w.title] = (titleCounts[w.title] ?? 0) + 1;
      if (w.lead_location) locationCounts[w.lead_location] = (locationCounts[w.lead_location] ?? 0) + 1;
      if (w.source) sourceCounts[w.source] = (sourceCounts[w.source] ?? 0) + 1;
      totalRevenue += w.deal_value ?? 0;
      totalScore += w.score ?? 0;
    }

    const sortByCount = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ key: k, count: v }));

    const fingerprint = {
      sample_size: wonArr.length,
      avg_score: Math.round(totalScore / wonArr.length),
      avg_deal_value: Math.round(totalRevenue / wonArr.length),
      top_titles: sortByCount(titleCounts),
      top_locations: sortByCount(locationCounts),
      top_sources: sortByCount(sourceCounts),
      total_revenue: totalRevenue,
    };

    // Optional: Claude generates strategic insights
    let aiInsight: string | null = null;
    let suggestedIcp: Record<string, unknown> | null = null;

    if (process.env.ANTHROPIC_API_KEY && wonArr.length >= 3) {
      try {
        const prompt = `Analyze this sales win/loss data to identify the ideal customer profile.

WON DEALS (${wonArr.length}):
${wonArr.slice(0, 20).map((w, i) => `${i+1}. ${w.title} | ${w.company} | ${w.lead_location} | score=${w.score} | $${(w.deal_value ?? 0)/100}`).join('\n')}

LOST DEALS (${lostArr.length}):
${lostArr.slice(0, 10).map((l, i) => `${i+1}. ${l.title} | ${l.company} | ${l.lead_location} | score=${l.score}`).join('\n')}

Identify the patterns that win deals share. Return ONLY this JSON:
{
  "insight": "<2-3 sentences explaining what your winning customers look like>",
  "suggested_icp": {
    "titles": ["...", "..."],
    "industries": ["..."],
    "location": "...",
    "min_score": <number>
  },
  "warning_signs": ["<sign that signals a likely-lose deal>"]
}`;

        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') {
          const cleaned = tb.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          const parsed = JSON.parse(cleaned);
          aiInsight = parsed.insight;
          suggestedIcp = parsed.suggested_icp;
        }
      } catch { /* swallow */ }
    }

    return NextResponse.json({
      ok: true,
      fingerprint,
      ai_insight: aiInsight,
      suggested_icp: suggestedIcp,
    });
  } catch (err) {
    console.error('[icp/analyze]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
