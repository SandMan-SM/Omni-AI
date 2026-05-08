// Stage N.1 — Pantheon Decision Engine: nightly weight rebalance.
//
// Reads the last 7d of impressions / clicks / conversions per creative
// and proposes a new pantheon_weight from a small ensemble of council
// lenses. The merged proposal is written back to cross_ad_creatives
// and the per-lens reasoning is logged to pantheon_proposals so the
// "Pantheon weight calendar" tab on the federation dashboard can show
// what each lens argued for.
//
// Algorithm is intentionally simple — explainable, debuggable, and
// upgradeable as more signal lands.

import type { SupabaseClient } from "@supabase/supabase-js";

type CreativeStat = {
  id: string;
  target_slug: string;
  base_weight: number;
  pantheon_weight: number;
  impressions_7d: number;
  clicks_7d: number;
  conversions_7d: number;
};

type LensProposal = {
  lens: string;
  delta: number;
  reasoning: string;
};

const SUN_TZU = "Sun Tzu";
const NAVAL = "Naval";
const ATHENA = "Athena";
const ISIS = "Isis";

// Weight per lens — sum doesn't have to equal 1; we average at the end.
const LENS_BLEND: Record<string, number> = {
  [SUN_TZU]: 0.4,
  [NAVAL]: 0.3,
  [ATHENA]: 0.2,
  [ISIS]: 0.1,
};

const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5.0;
const MAX_DELTA = 0.6; // never more than ±60% in a single rotation

/** Sun Tzu — opportunistic. Reward high CTR; punish low CTR hard. */
function sunTzu(s: CreativeStat): LensProposal {
  if (s.impressions_7d < 50) {
    return { lens: SUN_TZU, delta: 0, reasoning: "Insufficient impressions to assess weakness; hold." };
  }
  const ctr = s.clicks_7d / s.impressions_7d;
  if (ctr >= 0.05) return { lens: SUN_TZU, delta: +0.4, reasoning: `CTR ${(ctr * 100).toFixed(2)}% — strike where they're weak.` };
  if (ctr >= 0.025) return { lens: SUN_TZU, delta: +0.15, reasoning: `CTR ${(ctr * 100).toFixed(2)}% — modest gain.` };
  if (ctr >= 0.01) return { lens: SUN_TZU, delta: -0.1, reasoning: `CTR ${(ctr * 100).toFixed(2)}% — soft retreat.` };
  return { lens: SUN_TZU, delta: -0.4, reasoning: `CTR ${(ctr * 100).toFixed(2)}% — withdraw forces.` };
}

/** Naval — compounding. Reward conversions per impression more than clicks. */
function naval(s: CreativeStat): LensProposal {
  if (s.impressions_7d < 50) {
    return { lens: NAVAL, delta: 0, reasoning: "Too few impressions to compound on; hold." };
  }
  const cvr = s.conversions_7d / s.impressions_7d;
  if (cvr >= 0.005) return { lens: NAVAL, delta: +0.5, reasoning: `Per-impression CVR ${(cvr * 100).toFixed(2)}% — compound aggressively.` };
  if (cvr >= 0.002) return { lens: NAVAL, delta: +0.2, reasoning: `Per-impression CVR ${(cvr * 100).toFixed(2)}% — patient hold + small lean in.` };
  if (cvr === 0 && s.clicks_7d >= 30) return { lens: NAVAL, delta: -0.3, reasoning: `Clicks without conversions — leverage leak; reduce.` };
  return { lens: NAVAL, delta: 0, reasoning: "No clear compounding signal yet; patience." };
}

/** Athena — fairness across the federation. Cap any single creative's share. */
function athena(s: CreativeStat, allTargets: Record<string, number>, total: number): LensProposal {
  if (total <= 0) return { lens: ATHENA, delta: 0, reasoning: "No federation-wide impressions; hold." };
  const targetShare = (allTargets[s.target_slug] || 0) / total;
  if (targetShare > 0.5) return { lens: ATHENA, delta: -0.3, reasoning: `Target ${s.target_slug} owns ${(targetShare * 100).toFixed(1)}% of federation impressions; rebalance.` };
  if (targetShare < 0.05) return { lens: ATHENA, delta: +0.2, reasoning: `Target ${s.target_slug} owns ${(targetShare * 100).toFixed(1)}%; lift to ensure visibility.` };
  return { lens: ATHENA, delta: 0, reasoning: `Target share healthy at ${(targetShare * 100).toFixed(1)}%.` };
}

/** Isis — protect the creative that's actually warming the audience. */
function isis(s: CreativeStat): LensProposal {
  if (s.impressions_7d > 500 && s.clicks_7d / s.impressions_7d >= 0.04) {
    return { lens: ISIS, delta: +0.15, reasoning: "Audience leaning in; keep the warmth." };
  }
  if (s.clicks_7d === 0 && s.impressions_7d > 200) {
    return { lens: ISIS, delta: -0.2, reasoning: "Cold reception — give the slot to a creative with empathy." };
  }
  return { lens: ISIS, delta: 0, reasoning: "No clear warmth signal." };
}

function blend(proposals: LensProposal[]): number {
  let weighted = 0;
  let total = 0;
  for (const p of proposals) {
    const w = LENS_BLEND[p.lens] ?? 0;
    weighted += p.delta * w;
    total += w;
  }
  if (total <= 0) return 0;
  const merged = weighted / total;
  if (merged > MAX_DELTA) return MAX_DELTA;
  if (merged < -MAX_DELTA) return -MAX_DELTA;
  return merged;
}

function clamp(w: number): number {
  if (w < MIN_WEIGHT) return MIN_WEIGHT;
  if (w > MAX_WEIGHT) return MAX_WEIGHT;
  return w;
}

export type RebalanceResult = {
  creative_id: string;
  target_slug: string;
  prior_weight: number;
  new_weight: number;
  delta: number;
  proposals: LensProposal[];
};

export async function rebalanceCreativeWeights(sb: SupabaseClient): Promise<RebalanceResult[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: creatives, error: cErr } = await sb
    .from("cross_ad_creatives")
    .select("id, target_slug, base_weight, pantheon_weight")
    .eq("status", "active");
  if (cErr || !creatives) {
    console.error("[pantheon-decision] creatives select failed", cErr);
    return [];
  }

  const stats = await Promise.all(
    creatives.map(async (c: { id: string; target_slug: string; base_weight: number; pantheon_weight: number }) => {
      const [{ count: imp }, { count: clk }, { count: cvr }] = await Promise.all([
        sb.from("cross_ad_impressions").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("ts", sevenDaysAgo),
        sb.from("cross_ad_clicks").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("ts", sevenDaysAgo),
        sb.from("cross_ad_conversions").select("id", { count: "exact", head: true }).eq("creative_id", c.id).gte("attributed_at", sevenDaysAgo),
      ]);
      return {
        id: c.id,
        target_slug: c.target_slug,
        base_weight: c.base_weight,
        pantheon_weight: c.pantheon_weight,
        impressions_7d: imp || 0,
        clicks_7d: clk || 0,
        conversions_7d: cvr || 0,
      } satisfies CreativeStat;
    }),
  );

  // Federation-wide impression distribution by target_slug for Athena.
  const total = stats.reduce((a, s) => a + s.impressions_7d, 0);
  const byTarget: Record<string, number> = {};
  for (const s of stats) byTarget[s.target_slug] = (byTarget[s.target_slug] || 0) + s.impressions_7d;

  const results: RebalanceResult[] = [];
  for (const s of stats) {
    const proposals = [sunTzu(s), naval(s), athena(s, byTarget, total), isis(s)];
    const delta = blend(proposals);
    const newWeight = clamp(s.pantheon_weight * (1 + delta));
    results.push({
      creative_id: s.id,
      target_slug: s.target_slug,
      prior_weight: s.pantheon_weight,
      new_weight: newWeight,
      delta: newWeight - s.pantheon_weight,
      proposals,
    });
  }

  // Persist the new weights + proposal trail. Errors are logged but
  // never block — the cron should always finish.
  for (const r of results) {
    if (Math.abs(r.delta) < 0.01) continue;
    await sb
      .from("cross_ad_creatives")
      .update({ pantheon_weight: r.new_weight, updated_at: new Date().toISOString() })
      .eq("id", r.creative_id);

    for (const p of r.proposals) {
      await sb.from("pantheon_proposals").insert({
        proposing_lens: p.lens,
        topic: "cross_ad_weight",
        target_creative_id: r.creative_id,
        proposal_md: p.reasoning,
        delta_numeric: p.delta,
      }).then(({ error }) => {
        // pantheon_proposals may require different columns; if so, log
        // and move on so the rebalance still ships.
        if (error) console.warn("[pantheon-decision] proposal log failed", error);
      });
    }
  }

  return results;
}
