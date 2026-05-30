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
const OMNICLAW = "OmniClaw";

// Weight per lens — sum doesn't have to equal 1; we average at the end.
const LENS_BLEND: Record<string, number> = {
  [SUN_TZU]: 0.35,
  [NAVAL]: 0.3,
  [ATHENA]: 0.15,
  [ISIS]: 0.1,
  [OMNICLAW]: 0.1,
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

type OmniClawLensReview = {
  omniclaw_score: number;
  note: string;
};

function neutralOmniClawReview(): OmniClawLensReview {
  return {
    omniclaw_score: 0.5,
    note: "Neutral operator score; OmniClaw proxy not configured or unavailable.",
  };
}

function omniclaw(s: CreativeStat, review: OmniClawLensReview): LensProposal {
  const score = Math.max(0, Math.min(1, review.omniclaw_score));
  const delta = (score - 0.5) * 0.6;
  return {
    lens: OMNICLAW,
    delta,
    reasoning: `Operator clarity ${(score * 100).toFixed(0)}% — ${review.note}`,
  };
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function fetchOmniClawLensReviews(stats: CreativeStat[]): Promise<Record<string, OmniClawLensReview>> {
  if (process.env.OMNICLAW_ENABLED !== "true") {
    return {};
  }
  const proxyUrl = process.env.OMNICLAW_PROXY_URL;
  if (!proxyUrl) {
    return {};
  }

  const url = `${proxyUrl.replace(/\/$/, "")}/chat/completions`;
  const token = process.env.OMNICLAW_PROXY_TOKEN || "omniclaw-local";
  const model = process.env.OMNICLAW_MODEL || "gpt-5.5";
  const payload = stats.map((s) => ({
    proposal_id: s.id,
    target_slug: s.target_slug,
    current_weight: s.pantheon_weight,
    impressions_7d: s.impressions_7d,
    clicks_7d: s.clicks_7d,
    conversions_7d: s.conversions_7d,
  }));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Return strict JSON only. Score each proposal for operator clarity and single-human executability.",
          },
          {
            role: "user",
            content: `Return {"reviews":[{"proposal_id":"...","omniclaw_score":0.0,"note":"one line"}]} for these proposals:\n${JSON.stringify(payload)}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    clearTimeout(timer);
    if (!response.ok) {
      console.warn("[pantheon-decision] OmniClaw proxy review failed", response.status);
      return {};
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return {};
    const parsed = extractJsonObject(content);
    const reviews = (parsed as { reviews?: unknown[] } | null)?.reviews;
    if (!Array.isArray(reviews)) return {};

    const byId: Record<string, OmniClawLensReview> = {};
    for (const item of reviews) {
      if (!item || typeof item !== "object") continue;
      const row = item as { proposal_id?: unknown; omniclaw_score?: unknown; note?: unknown };
      if (typeof row.proposal_id !== "string") continue;
      if (typeof row.omniclaw_score !== "number") continue;
      byId[row.proposal_id] = {
        omniclaw_score: row.omniclaw_score,
        note: typeof row.note === "string" ? row.note.slice(0, 240) : "OmniClaw returned no note.",
      };
    }
    return byId;
  } catch (e) {
    console.warn("[pantheon-decision] OmniClaw proxy review unavailable", e);
    return {};
  }
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
  const omniclawReviews = await fetchOmniClawLensReviews(stats);

  const results: RebalanceResult[] = [];
  for (const s of stats) {
    const proposals = [
      sunTzu(s),
      naval(s),
      athena(s, byTarget, total),
      isis(s),
      omniclaw(s, omniclawReviews[s.id] ?? neutralOmniClawReview()),
    ];
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
