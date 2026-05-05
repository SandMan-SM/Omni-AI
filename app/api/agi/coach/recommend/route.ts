import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI deal coach: analyzes a business's pipeline and generates 5 prioritized
// recommendations. Looks for: stalled deals, hot replies needing follow-up,
// high-score leads with no outreach, etc.
//
// Admin-or-cron gated. Each call drives a Claude (Haiku) call AND inserts
// rows into omni_coach_recommendations. Without auth, anyone iterating
// business_id UUIDs could drain Claude budget + plant attacker-controlled
// recommendation text into the operator's coach panel.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    // Pull pipeline state
    const [{ data: leads }, { data: replies }, { data: bookings }] = await Promise.all([
      supabase.from('omni_leads_generated').select('id, first_name, last_name, company, title, score, status, deal_stage, deal_value, ai_recommended_angle, updated_at').eq('business_id', business_id).order('score', { ascending: false }).limit(100),
      supabase.from('omni_outreach_assets').select('id, lead_id, reply_text, reply_category, reply_handled, replied_at').eq('business_id', business_id).eq('status', 'replied').eq('reply_handled', false),
      supabase.from('omni_meeting_bookings').select('id, lead_id, attendee_name, start_at').eq('business_id', business_id).gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(20),
    ]);

    const leadsArr = leads ?? [];
    const repliesArr = replies ?? [];

    // Rule-based candidates (work even without Claude)
    type Rec = {
      lead_id: string | null;
      recommendation_type: string;
      priority: 'high' | 'medium' | 'low';
      recommendation: string;
      rationale: string;
      suggested_action: Record<string, unknown>;
    };
    const recs: Rec[] = [];

    // 1. Unhandled hot replies
    for (const r of repliesArr.slice(0, 5)) {
      if (r.reply_category === 'interested' || r.reply_category === 'meeting_booked' || r.reply_category === 'question') {
        const lead = leadsArr.find(l => l.id === r.lead_id);
        recs.push({
          lead_id: r.lead_id,
          recommendation_type: 'next_action',
          priority: 'high',
          recommendation: `Reply to ${lead ? `${lead.first_name} ${lead.last_name} @ ${lead.company}` : 'lead'} — they're interested`,
          rationale: `Reply categorized as ${r.reply_category}. Going stale = lost deal.`,
          suggested_action: { type: 'open_inbox', asset_id: r.id },
        });
      }
    }

    // 2. High-score leads with no outreach yet
    for (const l of leadsArr.filter(l => l.score >= 80 && l.status === 'new').slice(0, 5)) {
      const { count } = await supabase
        .from('omni_outreach_assets')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', l.id);
      if ((count ?? 0) === 0) {
        recs.push({
          lead_id: l.id,
          recommendation_type: 'opportunity',
          priority: 'high',
          recommendation: `Generate outreach for ${l.first_name} ${l.last_name} @ ${l.company} (score ${l.score})`,
          rationale: `High-score lead has no outreach assets yet. ${l.ai_recommended_angle ?? ''}`.trim(),
          suggested_action: { type: 'generate_outreach', lead_id: l.id },
        });
      }
    }

    // 3. Stalled mid-pipeline deals (qualified+ no activity 7d)
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    for (const l of leadsArr.filter(l =>
      ['qualified', 'demo', 'proposal', 'negotiation'].includes(l.deal_stage ?? '') &&
      new Date(l.updated_at) < sevenDaysAgo
    ).slice(0, 5)) {
      recs.push({
        lead_id: l.id,
        recommendation_type: 'risk_alert',
        priority: 'medium',
        recommendation: `Re-engage ${l.first_name} ${l.last_name} — stalled in ${l.deal_stage}`,
        rationale: `No activity in 7+ days. Mid-pipeline deals lose 15% per week of silence.`,
        suggested_action: { type: 'send_followup', lead_id: l.id },
      });
    }

    // Optional: Claude expands with strategic recommendations
    if (process.env.ANTHROPIC_API_KEY && recs.length < 5) {
      try {
        const summary = `Pipeline summary: ${leadsArr.length} leads, ${leadsArr.filter(l => l.status === 'qualified').length} qualified, ${repliesArr.length} unhandled replies, ${(bookings ?? []).length} upcoming meetings. Top lead: ${leadsArr[0]?.first_name} @ ${leadsArr[0]?.company} (score ${leadsArr[0]?.score}).`;
        const prompt = `You're a sales coach reviewing this pipeline:

${summary}

Existing rule-based recommendations have been generated. Add 1-3 STRATEGIC recommendations that aren't obvious. Focus on patterns: which segments are converting? What's the bottleneck? Where should the rep focus?

Return ONLY JSON array:
[{"recommendation":"...","rationale":"...","priority":"high|medium|low","type":"next_action|risk_alert|opportunity"}]`;

        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') {
          const cleaned = tb.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          const aiRecs = JSON.parse(cleaned) as Array<{ recommendation: string; rationale: string; priority: 'high' | 'medium' | 'low'; type: string }>;
          for (const ar of aiRecs.slice(0, 3)) {
            recs.push({
              lead_id: null,
              recommendation_type: ar.type ?? 'next_action',
              priority: ar.priority ?? 'medium',
              recommendation: ar.recommendation,
              rationale: ar.rationale,
              suggested_action: {},
            });
          }
        }
      } catch { /* swallow */ }
    }

    // Persist (replace existing pending recs for this business). Only
    // delete when we actually have replacements — same data-loss fix as
    // 135adda / 3fe60d2. Otherwise a coach run with zero usable recs
    // (rule-based produced none + Claude swallowed an error) wiped the
    // operator's existing pending recommendations with nothing to show.
    if (recs.length > 0) {
      await supabase
        .from('omni_coach_recommendations')
        .delete()
        .eq('business_id', business_id)
        .eq('acted_on', false);

      await supabase.from('omni_coach_recommendations').insert(
        recs.map(r => ({ ...r, business_id }))
      );
    }

    return NextResponse.json({ ok: true, count: recs.length, recommendations: recs });
  } catch (err) {
    console.error('[coach/recommend]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
