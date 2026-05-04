// Registry of "featured business" shoutouts that swap the standard Omni AI
// Schedule-a-Meeting CTA on a free newsletter post for an iMessage-style
// website preview card pointing at the partner business.
//
// One shoutout per slug — keep these spaced ~7 days apart for maximum
// conversion (the rest of the week's posts go to the standard CTA).
//
// To add a new shoutout: drop a new entry keyed by its slug-prefix. The
// post must already use that prefix (e.g. `prime_iv-...`, `leifson-...`).
// Premium posts are intentionally excluded — premium subscribers paid for
// pure Omni AI insights, not shoutouts.

export type Shoutout = {
  /** Display name on the preview card. */
  name: string;
  /** Full https:// URL the card opens. */
  url: string;
  /** Bare host shown above the title (mimics iMessage rich link UI). */
  host: string;
  /** Sharable description — reads like a text someone forwarded. */
  description: string;
  /** Optional offer line — bold, pulls eyes to the conversion. */
  offer?: string;
  /** Optional hero image URL (1200x630-ish; can be /public path or remote). */
  image?: string;
  /** Optional alt text for the image. */
  imageAlt?: string;
  /** Optional accent — defaults to amber to match the post chrome. */
  accent?: "amber" | "blue" | "emerald" | "rose";
};

// Match by slug prefix. First match wins, so order doesn't matter as long
// as prefixes are unambiguous (which they are — each business owns its
// `<slug>-…` namespace). Some legacy posts use hyphens (`prime-iv-`)
// and newer posts use underscores (`prime_iv-`); both forms are listed
// so older issues pick up the same card.
const SHOUTOUTS: Record<string, Shoutout> = {
  prime_iv: {
    name: "Prime IV Hydration · Sandy",
    url: "https://primeivsandy.com",
    host: "primeivsandy.com",
    description:
      "$85 IV therapy introductory offer to make you look better, feel better, and perform better. New clients only.",
    offer: "$85 intro offer · new clients · 385-318-3283",
    accent: "blue",
  },
  "prime-iv": {
    name: "Prime IV Hydration · Sandy",
    url: "https://primeivsandy.com",
    host: "primeivsandy.com",
    description:
      "$85 IV therapy introductory offer to make you look better, feel better, and perform better. New clients only.",
    offer: "$85 intro offer · new clients · 385-318-3283",
    accent: "blue",
  },
  ltb: {
    name: "Love Thy Barber",
    url: "https://lovethybarber.shop",
    host: "lovethybarber.shop",
    description:
      "Premium men's grooming, classic cuts, and hot-towel shaves. First-time clients get a discount on the chair.",
    offer: "$5 off your first visit",
    accent: "rose",
  },
  leifson: {
    name: "Leifson Built",
    url: "https://leifsonbuilt.com",
    host: "leifsonbuilt.com",
    description:
      "Custom-build contractor for homeowners who want the spec sheet, not the surprise. Free estimate, line-item pricing, no quiet add-ons.",
    offer: "Free, itemized estimate",
    accent: "emerald",
  },
  youngs: {
    name: "Youngs Cabinet Refinishing",
    url: "https://youngscabinetrefinishing.com",
    host: "youngscabinetrefinishing.com",
    description:
      "Cabinet refinishing that lasts — full prep, factory-grade finish, no on-site overspray. Refinish instead of replacing and save 60–70%.",
    offer: "Free in-home color & quote consultation",
    accent: "amber",
  },
};

// ─── Weekly shoutout schedule ─────────────────────────────────────────
// The newsletter publishes daily, but only ONE business gets shouted out
// per week to keep conversion sharp. Cycle alternates LTB ↔ Prime IV
// every Wednesday. Older content scrolls off the schedule and reverts
// to the standard Schedule-a-Meeting CTA.
//
// Each entry's `weekStart` is a Wednesday. The entry covers from that
// Wednesday through the day before the next entry's Wednesday (i.e. the
// following Tuesday). Posts whose published_at falls in that range and
// whose slug-prefix matches `partner` render the shoutout card; posts
// in the same week with a different partner-prefix fall through to the
// standard CTA. List newest-first so the lookup short-circuits.
//
// To add a new week: prepend a new entry. To bring Leifson or Youngs
// into the rotation, just use their key as `partner` and the existing
// SHOUTOUTS registry entry handles the rest.

type PartnerKey = keyof typeof SHOUTOUTS;

const SHOUTOUT_SCHEDULE: ReadonlyArray<{ weekStart: string; partner: PartnerKey }> = [
  // Future weeks — pre-filled so the next batch of posts lights up
  // automatically without a code change.
  { weekStart: "2026-05-13", partner: "prime_iv" },
  { weekStart: "2026-05-06", partner: "ltb" },
  // Current Wednesday-anchored week (Apr 29 – May 5): Love Thy Barber
  { weekStart: "2026-04-29", partner: "ltb" },
  // Last week (Apr 22 – Apr 28): Prime IV
  { weekStart: "2026-04-22", partner: "prime_iv" },
  // Alternate going back so historic issues show the right card.
  { weekStart: "2026-04-15", partner: "ltb" },
  { weekStart: "2026-04-08", partner: "prime_iv" },
  { weekStart: "2026-04-01", partner: "ltb" },
  { weekStart: "2026-03-25", partner: "prime_iv" },
  { weekStart: "2026-03-18", partner: "ltb" },
  { weekStart: "2026-03-11", partner: "prime_iv" },
  { weekStart: "2026-03-04", partner: "ltb" },
  { weekStart: "2026-02-25", partner: "prime_iv" },
  { weekStart: "2026-02-18", partner: "ltb" },
  { weekStart: "2026-02-11", partner: "prime_iv" },
  { weekStart: "2026-02-04", partner: "ltb" },
  // Posts published before the earliest weekStart fall through to the
  // standard CTA — no card. Acceptable: those are deep archive content.
];

function getScheduledPartner(publishedAt: string | null | undefined): PartnerKey | null {
  if (!publishedAt) return null;
  const pubDate = publishedAt.slice(0, 10); // YYYY-MM-DD lex order matches calendar order
  for (const entry of SHOUTOUT_SCHEDULE) {
    if (pubDate >= entry.weekStart) return entry.partner;
  }
  return null;
}

// Map a partner key to all slug prefixes that resolve to it. Most partners
// have one prefix; Prime IV has two (legacy `prime-iv-` and current
// `prime_iv-`) since older issues were authored before the slug scheme
// settled on underscores.
const PREFIXES_FOR_PARTNER: Record<PartnerKey, string[]> = {
  prime_iv: ["prime_iv-", "prime-iv-"],
  "prime-iv": ["prime-iv-", "prime_iv-"], // alias — both registry keys point at the same content
  ltb: ["ltb-"],
  leifson: ["leifson-"],
  youngs: ["youngs-"],
};

/**
 * Resolve a featured-business shoutout for a newsletter post.
 *
 * Returns a shoutout only when ALL three conditions hold:
 *   1. Post is on the free tier (premium is shoutout-free by policy).
 *   2. Post's published_at falls inside a scheduled week.
 *   3. Post's slug-prefix matches the partner scheduled for that week.
 *
 * Posts that are partner-prefixed but mismatch the week (e.g. a Prime IV
 * issue published during a Love-Thy-Barber week) render the standard
 * Schedule-a-Meeting CTA instead. This is what enforces "one shoutout
 * per week, alternating every Wednesday."
 */
export function getShoutoutForSlug(
  slug: string,
  tier: string | null,
  publishedAt?: string | null,
): Shoutout | null {
  if (tier === "premium") return null;

  const scheduled = getScheduledPartner(publishedAt);
  if (!scheduled) return null;

  const prefixes = PREFIXES_FOR_PARTNER[scheduled] ?? [`${scheduled}-`];
  const matches = prefixes.some((p) => slug.startsWith(p));
  if (!matches) return null;

  return SHOUTOUTS[scheduled];
}
