// Stage N.0/N.1 — federation cross-promo helpers.
// Server-side: pulls eligible creatives, scores via Pantheon Decision
// Engine, returns the chosen creative with attribution params already
// templated in. Used by /api/cross-ads.

export type CrossAdSlot = "header" | "footer" | "content-end" | "sidebar-card";

export type CrossAdCreative = {
  id: string;
  source_slug: string | null;
  target_slug: string;
  slot: CrossAdSlot;
  eyebrow: string;
  headline_md: string;
  blurb_md: string | null;
  cta_text: string;
  cta_url_template: string;
  base_weight: number;
  pantheon_weight: number;
  status: string;
  audience_tags: string[];
};

export type ChosenCreative = {
  id: string;
  target_slug: string;
  slot: CrossAdSlot;
  eyebrow: string;
  headline: string;
  blurb: string | null;
  cta_text: string;
  href: string;
  weight: number;
};

export function isEligible(c: CrossAdCreative, originatingSlug: string, slot: CrossAdSlot): boolean {
  if (c.status !== "active") return false;
  if (c.slot !== slot) return false;
  if (c.target_slug === originatingSlug) return false; // never promote self to self
  return true;
}

export function templateUrl(template: string, params: { origin: string; creative: string }): string {
  return template
    .replaceAll("{origin}", encodeURIComponent(params.origin))
    .replaceAll("{creative}", encodeURIComponent(params.creative));
}

/**
 * Pick the highest-scoring creative for an originating slug + slot.
 * Score = base_weight * pantheon_weight. Tie-broken by reservoir
 * sampling so impressions distribute fairly when scores are equal.
 */
export function pickCreative(
  candidates: CrossAdCreative[],
  originatingSlug: string,
  slot: CrossAdSlot,
): ChosenCreative | null {
  const eligible = candidates.filter((c) => isEligible(c, originatingSlug, slot));
  if (eligible.length === 0) return null;
  const scored = eligible.map((c) => ({
    c,
    score: Math.max(0.001, c.base_weight) * Math.max(0.001, c.pantheon_weight),
  }));
  const total = scored.reduce((a, b) => a + b.score, 0);
  let roll = Math.random() * total;
  let pick = scored[0];
  for (const s of scored) {
    roll -= s.score;
    if (roll <= 0) {
      pick = s;
      break;
    }
  }
  const href = templateUrl(pick.c.cta_url_template, {
    origin: originatingSlug,
    creative: pick.c.id,
  });
  return {
    id: pick.c.id,
    target_slug: pick.c.target_slug,
    slot: pick.c.slot,
    eyebrow: pick.c.eyebrow,
    headline: pick.c.headline_md,
    blurb: pick.c.blurb_md,
    cta_text: pick.c.cta_text,
    href,
    weight: pick.score,
  };
}
