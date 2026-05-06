import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI lead scoring: uses Claude to evaluate fit beyond rule-based scoring.
// Considers title authority, company stage signals, tech stack relevance,
// industry alignment, and growth signals from Apollo company intel.
//
// Admin-or-cron gated. Each call hits Claude (Haiku, $/run) and writes
// AI fields into the lead row. Without auth, anyone iterating lead_id
// UUIDs could drain the Claude budget AND plant arbitrary text in
// ai_score_reasoning + ai_recommended_angle (visible in the dashboard).
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not set — AI scoring requires Claude API',
      }, { status: 503 });
    }

    const { data: lead } = await supabase
      .from('omni_leads_generated').select('*').eq('id', lead_id).single();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', lead.business_id).single();

    // Same hardening as lib/agi/outreach.ts fetchCompanyIntel — escape
    // SQL wildcards in lead.company (CSV imports often have % or _),
    // try exact case-insensitive match first, fall back to substring
    // ordered by name length so "Apple" doesn't latch onto "Pineapple
    // Computing".
    let intel: any | null = null;
    if (lead.company) {
      const escaped = String(lead.company).replace(/[%_\\]/g, c => `\\${c}`);
      const { data: exact } = await supabase
        .from('omni_company_intel')
        .select('*')
        .eq('business_id', lead.business_id)
        .ilike('name', escaped)
        .limit(1)
        .maybeSingle();
      if (exact) {
        intel = exact;
      } else {
        const { data: candidates } = await supabase
          .from('omni_company_intel')
          .select('*')
          .eq('business_id', lead.business_id)
          .ilike('name', `%${escaped}%`)
          .limit(5);
        if (candidates && candidates.length) {
          candidates.sort((a, b) => (String(a.name ?? '').length) - (String(b.name ?? '').length));
          intel = candidates[0];
        }
      }
    }

    const prompt = `Score this lead's fit for our outreach campaign.

LEAD:
- Title: ${lead.title}
- Company: ${lead.company}
- Location: ${lead.lead_location ?? 'unknown'}
- Has email: ${Boolean(lead.email)}
- Has phone: ${Boolean(lead.phone)}

OUR COMPANY (selling):
- ${business?.name} (${business?.industry})
- Sells to: ${describeBusinessICP(business)}

${intel ? `RICH COMPANY INTEL FROM APOLLO:
- Industry: ${intel.industry}
- Size: ${intel.estimated_num_employees} employees
- Founded: ${intel.founded_year}
- HQ: ${intel.city}, ${intel.state}
- Recent funding: ${intel.latest_funding_stage} (${intel.latest_funding_date})
- Tech stack signals: ${intel.technology_names?.slice(0, 10).join(', ')}
- Department sizes: ${JSON.stringify(intel.departmental_head_count)}
- Keyword signals: ${intel.keywords?.slice(0, 15).join(', ')}` : ''}

Evaluate fit on these dimensions:
1. Title authority — does this person decide on what we're selling? (0-25 pts)
2. Company stage match — right size, funding, growth state? (0-25 pts)
3. Industry alignment — do they have the pain we solve? (0-25 pts)
4. Reachability — can we actually reach them? (0-15 pts)
5. Buying signals — recent funding, hiring, growth keywords? (0-10 pts)

Return ONLY this JSON:
{
  "score": <0-100>,
  "reasoning": "<2 sentences max — what makes them strong/weak fit>",
  "key_signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "recommended_angle": "<1 sentence — best opener angle for outreach>"
}`;

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = resp.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude');
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(cleaned) as {
      score: number;
      reasoning: string;
      key_signals: string[];
      recommended_angle: string;
    };

    // Update lead with AI score (replaces rule-based score) and stash the
    // AI reasoning into dedicated columns so we don't clobber the operator's
    // manual notes. Previously this wrote the AI summary into `notes`,
    // which destroyed whatever the operator had typed (call recap, custom
    // priority, internal context) every time they re-scored.
    await supabase
      .from('omni_leads_generated')
      .update({
        score: Math.max(0, Math.min(100, Math.round(result.score))),
        ai_score_reasoning: result.reasoning,
        ai_recommended_angle: result.recommended_angle,
      })
      .eq('id', lead_id);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[leads/score-ai]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

function describeBusinessICP(business: { industry?: string; name?: string } | null): string {
  if (!business) return 'unknown';
  const industry = (business.industry ?? '').toLowerCase();
  if (industry.includes('roofing')) return 'commercial property managers, facility directors';
  if (industry.includes('health') || industry.includes('iv')) return 'HR directors, benefits managers, COOs at growing companies';
  if (industry.includes('barber') || industry.includes('salon')) return 'executive memberships, corporate event planners';
  if (industry.includes('marketing') || industry.includes('seo')) return 'small business owners, marketing managers';
  return `decision-makers in ${business.industry}`;
}
