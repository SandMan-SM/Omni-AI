import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Bulk re-score every lead in a business using Claude.
// Pulls company intel for each lead and feeds it into a fit-prediction prompt.
// Updates score, ai_score_reasoning, ai_recommended_angle.
//
// Admin-or-cron gated. Per call hits Claude up to max_leads times (Haiku
// each). Without auth, anyone could repeatedly POST `{ business_id }` to
// drain the Anthropic budget. The Telegram bot's /score command already
// passes through cron-or-admin (telegram webhook is CRON_SECRET-checked).
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, only_unscored, max_leads } = await req.json() as {
      business_id: string;
      only_unscored?: boolean;
      max_leads?: number;
    };

    if (!business_id) {
      return NextResponse.json({ error: 'business_id required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
    }

    // Order newest-first so when the operator hits bulk-score the recent
    // leads get the AI treatment first (most actionable), and so repeat
    // calls process the same deterministic prefix of the queue rather
    // than a random 25 each time.
    let query = supabase
      .from('omni_leads_generated')
      .select('id, first_name, last_name, title, company, lead_location, email, phone, score, ai_score_reasoning')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(max_leads ?? 25);
    if (only_unscored) query = query.is('ai_score_reasoning', null);

    const { data: leads } = await query;
    if (!leads || leads.length === 0) {
      return NextResponse.json({ ok: true, scored: 0, note: 'No leads to score' });
    }

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', business_id).single();

    // Pull all company intel for this business once
    const { data: allIntel } = await supabase
      .from('omni_company_intel')
      .select('name, industry, estimated_num_employees, latest_funding_stage, technology_names, departmental_head_count')
      .eq('business_id', business_id);

    const intelByCompany = new Map<string, NonNullable<typeof allIntel>[number]>();
    for (const i of allIntel ?? []) {
      if (i.name) intelByCompany.set(i.name.toLowerCase(), i);
    }

    type Result = { lead_id: string; old_score: number; new_score: number; reasoning: string };
    const results: Result[] = [];

    // Same intel-resolution fix as score-ai + outreach: prefer exact
    // case-insensitive match, fall back to substring with shortest-
    // name preference. The previous `.find(([k]) => k.includes(company))`
    // matched "Pineapple Computing" against lead.company="Apple"
    // because "pineapple computing".includes("apple") = true, and the
    // first map entry won regardless of which was the better match.
    const resolveIntel = (company: string | null) => {
      if (!company) return null;
      const lower = company.toLowerCase();
      const exact = intelByCompany.get(lower);
      if (exact) return exact;
      const candidates: NonNullable<typeof allIntel>[number][] = [];
      Array.from(intelByCompany.entries()).forEach(([k, v]) => {
        if (k.includes(lower)) candidates.push(v);
      });
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => (String(a.name ?? '').length) - (String(b.name ?? '').length));
      return candidates[0];
    };

    for (const lead of leads) {
      const intel = resolveIntel(lead.company);

      const prompt = `Score this lead's fit (0-100). Be strict; reserve >85 for strong matches.

LEAD: ${lead.first_name ?? ''} ${lead.last_name ?? ''} · ${lead.title ?? '?'} @ ${lead.company ?? '?'}
${lead.lead_location ? `Location: ${lead.lead_location}` : ''}
Has email: ${Boolean(lead.email)}, has phone: ${Boolean(lead.phone)}

OUR BUSINESS: ${business?.name} (${business?.industry})

${intel ? `APOLLO INTEL: ${intel.estimated_num_employees} emp · ${intel.industry} · ${intel.latest_funding_stage ?? 'no funding'} · tech: ${intel.technology_names?.slice(0,5).join(', ')}` : 'NO COMPANY INTEL AVAILABLE'}

Score factors:
- Title authority (does this person decide?)
- Company stage (right size for our offer)
- Industry fit
- Reachability (email/phone)
- Buying signals (funding, growth, tech stack alignment)

Return ONLY JSON:
{"score": <0-100>, "reasoning": "<1 sentence>", "angle": "<best opener angle, 1 sentence>"}`;

      try {
        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        });
        const textBlock = resp.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') continue;
        const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned) as { score: number; reasoning: string; angle: string };

        await supabase
          .from('omni_leads_generated')
          .update({
            score: Math.max(0, Math.min(100, Math.round(parsed.score))),
            ai_score_reasoning: parsed.reasoning,
            ai_recommended_angle: parsed.angle,
          })
          .eq('id', lead.id);

        results.push({
          lead_id: lead.id,
          old_score: lead.score,
          new_score: parsed.score,
          reasoning: parsed.reasoning,
        });
      } catch {
        // skip individual failures
      }
    }

    return NextResponse.json({
      ok: true,
      scored: results.length,
      total_attempted: leads.length,
      results,
    });
  } catch (err) {
    console.error('[leads/bulk-score]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
