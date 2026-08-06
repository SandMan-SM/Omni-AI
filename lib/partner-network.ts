// Omni Partner Network — single source of truth for cross-portfolio
// promotion. Every portfolio site's embed banner and every brand
// newsletter's Partner Spotlight rotates through THIS list.
//
// Mesh rules live here too (creativesForHost): a site never promotes
// itself, clinical/professional hosts only show audience-appropriate
// categories, and Fred Circle keeps the paid primary slot everywhere.
//
// Mirrored (hand-synced) in the Interlinked repo at
// app/core/growth/network.py for newsletter rendering — keep in step.

export type NetworkCategory =
  | "home-services"
  | "wellness"
  | "professional"
  | "media"
  | "commerce"
  | "community"
  | "personal";

export type NetworkEyebrow = "Sponsor" | "Partner" | "Featured";

export type NetworkMember = {
  // Stable slug. Must match the embed's data-slug where this business
  // hosts the banner, and the Growth Stack brand slug where one exists.
  slug: string;
  name: string;
  href: string;
  eyebrow: NetworkEyebrow;
  tagline: string;
  cta: string;
  category: NetworkCategory;
  // Relative rotation share. Fred (paid sponsor) outweighs the network.
  weight: number;
  utmCampaign: string;
};

export const PARTNER_NETWORK: NetworkMember[] = [
  {
    slug: "fred-circle",
    name: "Fred — Live with the Host",
    href: "https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc",
    eyebrow: "Sponsor",
    tagline: "Tap in to Fred's circle. Compound the days.",
    cta: "Open",
    category: "community",
    weight: 5,
    utmCampaign: "fred-circle",
  },
  {
    slug: "seoppc",
    name: "SEO & PPC Marketing",
    href: "https://seoandppcmarketing.com",
    eyebrow: "Partner",
    tagline: "Get found first. Search and ads engineered for local business.",
    cta: "Grow",
    category: "professional",
    weight: 2,
    utmCampaign: "seo-ppc-marketing",
  },
  {
    slug: "cps",
    name: "Psych & Custody Evaluations",
    href: "https://psychandcustodyevaluations.com",
    eyebrow: "Featured",
    tagline: "Trusted forensic and psychological evaluations across Utah.",
    cta: "Learn",
    category: "professional",
    weight: 2,
    utmCampaign: "cps-feature",
  },
  {
    slug: "omnileadsagi",
    name: "Omni AI",
    href: "https://omnileadsagi.com",
    eyebrow: "Partner",
    tagline: "Agentic infrastructure that runs your business around the clock.",
    cta: "See it",
    category: "professional",
    weight: 1,
    utmCampaign: "omni-ai",
  },
  {
    slug: "youngs",
    name: "Young's Cabinet Refinishing",
    href: "https://youngscabinetrefinishing.com",
    eyebrow: "Partner",
    tagline: "Showroom cabinets at refinishing prices, trusted across Utah.",
    cta: "Quote",
    category: "home-services",
    weight: 1,
    utmCampaign: "youngs-cabinets",
  },
  {
    slug: "leifson",
    name: "Utah Deck & Basement Remodel",
    href: "https://utahdeckandbasementremodel.com",
    eyebrow: "Partner",
    tagline: "Decks and basements built right the first time.",
    cta: "Build",
    category: "home-services",
    weight: 1,
    utmCampaign: "utah-deck-basement",
  },
  {
    slug: "ltb",
    name: "Love Thy Barber",
    href: "https://lovethybarber.shop",
    eyebrow: "Partner",
    tagline: "Cuts, color, and community in Salt Lake.",
    cta: "Book",
    category: "wellness",
    weight: 1,
    utmCampaign: "love-thy-barber",
  },
  /*
   * REMOVED 2026-08-04: "Prime IV Hydration — Sandy" (primeivsandy.com).
   * Its registry row is active=false, owned=false, and the only Prime-IV-adjacent
   * asset we actually own is the livebetteronthedrip.com domain. It was rotating
   * into every brand newsletter — promoting a business we do not own, from lists
   * we do. Do not re-add without an owned+active row in analytics.tenants.
   */
  {
    slug: "alira",
    name: "Alira",
    href: "https://alira.live",
    eyebrow: "Partner",
    tagline: "Spiritual leadership, retreats, and certification programs.",
    cta: "Explore",
    category: "community",
    weight: 1,
    utmCampaign: "alira",
  },
  {
    slug: "rene",
    name: "Rene Laveau",
    href: "https://renelaveau.com",
    eyebrow: "Featured",
    tagline: "Original work from artist Rene Laveau.",
    cta: "View",
    category: "personal",
    weight: 1,
    utmCampaign: "rene-laveau",
  },
  {
    slug: "imperium",
    name: "Imperium",
    href: "https://secretimperium.com",
    eyebrow: "Partner",
    tagline: "Limited streetwear drops. Members see them first.",
    cta: "Shop",
    category: "commerce",
    weight: 1,
    utmCampaign: "imperium",
  },
  {
    /*
     * Slug was "greenwood", which has no row in analytics.tenants — so this entry
     * could never resolve against the registry. The surface itself IS owned:
     * arizonaphoenixrentals.com, registry slug `arizonaphoenixrentals`, owned+active.
     * Renamed to match the registry rather than removed.
     */
    slug: "arizonaphoenixrentals",
    name: "Arizona Phoenix Rentals",
    href: "https://arizonaphoenixrentals.com",
    eyebrow: "Featured",
    tagline: "Short-term and vacation property rentals across the Phoenix valley.",
    cta: "Stay",
    category: "home-services",
    weight: 1,
    utmCampaign: "arizona-phoenix-rentals",
  },
  {
    slug: "omnileads",
    name: "Omni Leads",
    href: "https://omnileads.shop",
    eyebrow: "Partner",
    tagline: "Qualified leads on tap for local businesses.",
    cta: "Start",
    category: "professional",
    weight: 1,
    utmCampaign: "omni-leads",
  },
  {
    slug: "agiarena",
    name: "AGI Arena",
    href: "https://agiarena.online",
    eyebrow: "Partner",
    tagline: "Where builders learn to ship with AI.",
    cta: "Enter",
    category: "community",
    weight: 1,
    utmCampaign: "agi-arena",
  },
  {
    slug: "newsletter-studio",
    name: "Newsletter Studio",
    href: "https://newsletterstudio.dev",
    eyebrow: "Partner",
    tagline: "Owned-audience newsletters, built and run for you.",
    cta: "Launch",
    category: "media",
    weight: 1,
    utmCampaign: "newsletter-studio",
  },
  {
    slug: "taniela",
    name: "Taniela Fiefia",
    href: "https://tanielafiefia.com",
    eyebrow: "Featured",
    tagline: "Athlete. Builder. Story in motion.",
    cta: "Follow",
    category: "personal",
    weight: 1,
    utmCampaign: "taniela-fiefia",
  },
];

// ── Mesh rules ───────────────────────────────────────────────────────────
// Hosts that serve a clinical / high-trust professional audience only show
// audience-appropriate categories. Everyone else sees the full network.
// A site never promotes itself. Fred (paid sponsor) shows everywhere.

const CLINICAL_HOSTS = new Set(["cps"]);
const CLINICAL_ALLOWED: NetworkCategory[] = ["professional", "media", "community"];

// data-slug values used by the embeds on each site, mapped to the network
// slug of the business that OWNS that site (so we can exclude self-promo).
const HOST_TO_MEMBER: Record<string, string> = {
  cps: "cps",
  leifson: "leifson",
  youngs: "youngs",
  ltb: "ltb",
  alira: "alira",
  rene: "rene",
  omnileads: "omnileads",
  omni: "omnileadsagi",
  arizonaphoenixrentals: "arizonaphoenixrentals",
  // `prime_iv`, `phoenix` and `niki` were removed 2026-08-04 — all three are
  // owned=false / active=false in analytics.tenants, so they are not federation
  // hosts and must not appear as network members either.
  // News brands host the banner but are not creatives themselves.
  wasatch: "wasatch",
  mainst: "mainst",
  beehive: "beehive",
};

export function creativesForHost(hostSlug: string): NetworkMember[] {
  const self = HOST_TO_MEMBER[hostSlug] ?? hostSlug;
  let pool = PARTNER_NETWORK.filter((m) => m.slug !== self);
  if (CLINICAL_HOSTS.has(hostSlug)) {
    pool = pool.filter(
      (m) => m.slug === "fred-circle" || CLINICAL_ALLOWED.includes(m.category)
    );
  }
  return pool;
}
