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

/**
 * Resolve a featured-business shoutout for a newsletter post slug, or null
 * if the post is a standard Omni AI issue. Premium posts always return
 * null even if their slug matches — premium is shoutout-free by policy.
 */
export function getShoutoutForSlug(
  slug: string,
  tier: string | null,
): Shoutout | null {
  if (tier === "premium") return null;
  for (const [prefix, payload] of Object.entries(SHOUTOUTS)) {
    if (slug.startsWith(`${prefix}-`)) return payload;
  }
  return null;
}
