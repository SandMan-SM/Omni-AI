// Federation case studies — one entry per shipped or in-flight surface.
// Drives the dynamic route at /infrastructure/development/[slug] and
// the index at /infrastructure/development. Every field is operator-
// authored copy; live metrics (events / leads / referrals / ELO) are
// fetched at request time from Supabase by slug-from-this-table.
//
// To add a new case study: drop a new entry below and ship.

export type SystemLayer = {
  layer: string;
  what: string;
};

export type PricingLine = {
  line: string;
  price: string;
  note: string;
};

export type AdditionalSurface = {
  label: string;   // human label for the button (e.g. "Podcast site")
  url: string;     // full canonical URL with protocol
  domain: string;  // display domain (no protocol)
};

export type CaseStudy = {
  slug: string;                    // url segment (e.g. "rene-laveau")
  brand: string;                   // display name
  domain: string;                  // primary public domain (no protocol)
  url: string;                     // primary full canonical URL
  /** Optional additional public surfaces this engagement delivered
   *  (e.g. a paired podcast site, an admin app, a partner microsite).
   *  Rendered as extra Visit-button pills in the detail-page hero.
   *  The primary `url` field stays the headline asset; these are
   *  companion deliverables. */
  additionalSurfaces?: AdditionalSurface[];
  /** Optional override for the hero primary-button label. Defaults to
   *  `Visit {domain}`. Use when the headline asset reads better as
   *  something other than a domain visit (e.g. "View Asset"). */
  primaryCtaLabel?: string;
  /** Optional single headline result metric. When set, the
   *  "What this node has actually done" section renders this one large
   *  stat INSTEAD of the shared 4-stat grid — for studies whose story is
   *  one outcome (e.g. "70% reduction in lost leads"). */
  headlineMetric?: { value: string; label: string };
  /** Optional companion-asset card rendered under the metrics section.
   *  Use for a secondary deliverable that isn't the headline asset
   *  (e.g. the operator site when the podcast is the headline). */
  featuredAssetCard?: { title: string; description: string; buttonLabel: string; url: string };
  inboundSlug: string | null;      // matching key in inbound_<slug>_* tables / cross_brand_referrals; null = no analytics
  /** Optional list of OTHER business slugs whose analytics should fold
   *  into this case study's combined view (e.g. an Imperium case study
   *  that also includes ltb + omni newsletter activity because they all
   *  share the Mastermind funnel). The page sums events/leads/referrals
   *  across `inboundSlug` + every entry in this array. */
  combinedSlugs?: string[];
  realm: 1 | 2 | 3;                // I=site, II=HQ/dashboard, III=Interlinked
  role: string;                    // "Operator · AI CEO" / "Mastermind" / etc.
  status: "live" | "in_progress" | "scaffold" | "forthcoming" | "archived";
  pantheonArchetype: string | null; // lens that drives the agent (Prometheus, Rockefeller, etc.)
  pantheonCEO: string | null;       // council_agents.name for live-ELO lookup
  tagline: string;                  // single-line subhead under the H1
  problem: string;                  // 1-2 sentences on what was needed
  solution: string;                 // 1-2 sentences on what was built
  systems: SystemLayer[];           // engineering inventory
  agenticStack: string[];           // bullet list of what the AI CEO does for this node
  pricing: PricingLine[];           // engagement pricing (default Tier 3 unless customized)
  marketTier: "template" | "themed" | "bespoke" | "federation";
  marketTierLabel: string;          // human-friendly tier name
  buildPriceRange: string;          // e.g. "$18k – $25k"
  liveSince: string | null;         // YYYY-MM
};

const TIER3_PRICING: PricingLine[] = [
  { line: "Discovery + brand DNA capture", price: "$1,500 fixed", note: "Brand interview, voice + visual lock, asset list." },
  { line: "Custom build (Tier 3 spec)", price: "$18,000 – $25,000", note: "Scoped on complexity. Mid-market default $20k." },
  { line: "Federation onboarding", price: "$3,500 one-time", note: "Slug registration, cross-promo creative, Pantheon CEO seed, analytics tables." },
  { line: "Hosting + maintenance retainer", price: "$750 – $1,500 / mo", note: "Vercel + Supabase infra, content support, federation membership." },
  { line: "Sponsor revenue split", price: "30% of brokered sponsor revenue", note: "On the federation slot we curate." },
  { line: "Booking attribution", price: "10% of federation-referred bookings", note: "Tracked via cross_brand_referrals." },
];

const FEDERATION_PRICING: PricingLine[] = [
  { line: "Federation HQ membership", price: "Equity / partnership", note: "This node IS the HQ — pricing not applicable." },
];

const TEMPLATE_PRICING: PricingLine[] = [
  { line: "Funnel scaffold", price: "$2,500 – $4,500", note: "Single-page or short-flow Next.js scaffold." },
  { line: "Federation embed", price: "$500 one-time", note: "Tracker + cross-promo + slug registration." },
  { line: "Hosting", price: "$150 / mo", note: "Vercel + Supabase share." },
];

const STANDARD_SYSTEMS: SystemLayer[] = [
  { layer: "Engineering", what: "Next.js + React 19 custom codebase. Bespoke components + design tokens. Modern Tailwind." },
  { layer: "Pages", what: "Home + 4-8 sub-pages tuned to the operator's intake flow. Custom 404 + loading states." },
  { layer: "Design", what: "Custom palette + typography + branded animation. Brand identity, not a template." },
  { layer: "SEO + JSON-LD", what: "Structured data per page type (Organization / LocalBusiness / Article / Product). Sitemap, robots, llms.txt, Satori-safe OG." },
  { layer: "Analytics pipeline", what: "Custom tracker → omnileadsagi.com inbound API → inbound_<slug>_* Supabase tables. Page-view, click, scroll-depth, form-submit, federation referral capture." },
  { layer: "Federation integration", what: "Slim sponsor banner + universal cross-promo embed. Inbound CRM mirror to omni_leads_generated." },
  { layer: "Ops", what: "Vercel project bound, DNS configured, SSL provisioned, OG/Twitter images." },
];

const STANDARD_AGENTIC: string[] = [
  "Inbound lead routing + classification on every form submit.",
  "First-response SLA tracking via inbound_<slug>_leads.email_notified / telegram_notified.",
  "Per-tenant analytics rollups visible in /dashboard pinned to this workspace.",
  "Federation cross-promo weight tuning via Pantheon Decision Engine (Sun Tzu / Naval / Athena / Isis lens blend).",
  "Council Codex obeyed on every reasoning cycle — name-scrub, continuous execution, no-cron, etc.",
];

export const CASE_STUDIES: CaseStudy[] = [
  // ────────────── Realm II — Federation HQ ──────────────
  {
    slug: "omni-ai",
    brand: "Omni AI",
    domain: "omnileadsagi.com",
    url: "https://omnileadsagi.com",
    inboundSlug: "omnileads",
    // Federation HQ aggregates EVERY tenant's analytics — its case study
    // dashboard should reflect the full network, not just omnileadsagi.com
    // page-views. Order kept stable for readable per-business breakdown.
    combinedSlugs: [
      "sitanim", "imperium", "rene", "cps", "leifson", "youngs",
      "ltb", "phoenix", "prime_iv", "mainst", "beehive", "wasatch",
      "alira", "otd",
    ],
    realm: 2,
    role: "Federation HQ · Pantheon",
    status: "live",
    pantheonArchetype: "Pantheon (composite)",
    pantheonCEO: null,
    tagline: "The federation HQ. The Pantheon. The Oracle. The dashboard. The reason every other node compounds.",
    problem: "Sixteen owned domains, an autonomous agent platform, and a per-client AI CEO layer with no shared substrate would mean sixteen disconnected sites and zero compounding. Every operator would be alone.",
    solution: "Built the HQ that ties it all together: inbound API per tenant, Pantheon decision engine, cross-promo embeds, federation dashboard, the Oracle, the public Council Codex, the agentic dashboard, and every script that makes the rest of the network compound.",
    systems: [
      { layer: "Federation backbone", what: "Inbound API at /api/inbound/[slug]/{events,leads,newsletter-event}. CORS allowlist per slug. Service-role writes to inbound_<slug>_* tables." },
      { layer: "Cross-ad substrate", what: "/api/cross-ads picks creatives via Pantheon Decision Engine. /api/cross-ads/click logs the trip. /embed/federation-ad.js + /embed/sponsor.js render slim banners on every Realm I site." },
      { layer: "Pantheon Decision Engine", what: "lib/pantheon-decision.ts blends 4 lenses (Sun Tzu 40% / Naval 30% / Athena 20% / Isis 10%). Nightly weight rebalance route /api/cron/pantheon-review (manual-trigger; crons disabled per directive)." },
      { layer: "Council Codex", what: "council_directives table + /api/council/codex public read. 32 council_agents acknowledged the operative directives in pantheon_dialogue." },
      { layer: "Federation dashboard", what: "/dashboard/federation surfaces 30d funnel + attribution leaderboard from cross_ad_* + cross_brand_referrals." },
      { layer: "Oracle", what: "/oracle is the canonical thesis — society of minds, three realms, Pantheon roster, what ASI looks like in commercial reality." },
      { layer: "Morning digest", what: "/api/cron/morning-digest emails sitanim8@gmail.com daily at 06:00 ET with intel digest, Pantheon stewards, federation overnight block, top findings." },
    ],
    agenticStack: [
      "Pantheon — 28 archetypal agents + per-business CEOs reason inside one council_agents table.",
      "32 acknowledgements logged in pantheon_dialogue confirming directives in each agent's voice.",
      "Public /api/council/leaderboard exposes the live ELO + tier roster.",
      "Federation Decision Engine adjusts cross-promo weights based on real CTR / CVR / fairness signals.",
      "/dashboard/council shows the active codex + every acknowledgement (Mafi-only view).",
    ],
    pricing: FEDERATION_PRICING,
    marketTier: "federation",
    marketTierLabel: "Federation HQ — not for sale",
    buildPriceRange: "$30k – $80k+",
    liveSince: "2025-11",
  },

  // ────────────── Realm I — Founder + Mastermind ──────────────
  {
    slug: "sitani-mafi",
    brand: "Sitani Mafi",
    domain: "sitanimafi.live",
    url: "https://sitanimafi.live",
    inboundSlug: "sitanim",
    realm: 1,
    role: "Founder flagship · Operator",
    status: "live",
    pantheonArchetype: "Prometheus",
    pantheonCEO: "Sitani Mafi CEO",
    tagline: "Founder flagship. Agentic Engineer. To preserve culture we must continue to create it.",
    problem: "The federation needed a face — a single canonical surface where the operator's voice, portfolio, sponsors, and mastermind connection all lived in one cinematic experience.",
    solution: "Built a single-page narrative with 13 components, cosmic background, full sponsor + portfolio + writing themes + Prometheus archetype. Sub-pages for /portfolio, /sponsor, /contact, /ads. Full federation integration.",
    systems: [
      { layer: "Engineering", what: "Next 15 + React 19 + Tailwind 4. 13 narrative components (Hero, Manifesto, AgenticEngineer, Mastermind, PartnerBusiness, TopSponsor, SponsorRow, ClientShowcase, AdGallery, WritingTeasers, Prometheus, Contact, Footer)." },
      { layer: "Cosmic background", what: "GPU-accelerated CSS-only: 3 aurora blobs drifting on independent loops, 140 hash-distributed twinkling stars, dotted lattice, warm gold spotlight from above. prefers-reduced-motion honored." },
      { layer: "Pages", what: "Single-page narrative + /portfolio + /portfolio/[slug] (16 client cards) + /sponsor + /contact + /ads. Custom not-found + loading." },
      { layer: "Design", what: "Oracle palette navy + emerald→cyan→purple spectrum + Imperium gold. Playfair Display + Inter + Italianno. Bespoke for the Prometheus archetype." },
      { layer: "SEO + JSON-LD", what: "Person + Organization schemas. Sitemap, robots, llms.txt route, Satori-safe OG, twitter-image with literal exports." },
      { layer: "Analytics + federation", what: "Custom InboundTracker → /api/inbound/sitanim/* with referral capture. SponsorBanner + federation-ad-footer mounted." },
    ],
    agenticStack: [
      "Sitani Mafi CEO seeded in council_agents with Prometheus lens, business_id linked.",
      "Federation cross-promo creative for sitanim slug actively in rotation (base_weight 4.0, the highest non-omni weight).",
      "Inbound leads land in inbound_sitanim_leads + mirror to omni_leads_generated CRM.",
      "Cross_brand_referrals captured both inbound (omni→sitanim) and outbound (sitanim→imperium) — verified end-to-end.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-05",
  },
  {
    slug: "imperium",
    brand: "Imperium",
    domain: "secretimperium.com",
    url: "https://secretimperium.com",
    inboundSlug: "imperium",
    realm: 1,
    role: "Mastermind · Commerce + Content",
    status: "live",
    pantheonArchetype: "Rockefeller",
    pantheonCEO: "Imperium CEO",
    tagline: "Mastermind. Strategy, leverage, systems. By invitation. The 28 principles. Daily dispatch.",
    problem: "Imperium had a substantial Next 16 e-commerce app (shop, cart, checkout, account, admin, newsletter, 28principles, portal) but no federation integration — leads invisible to the dashboard, no cross-promo, no Pantheon CEO.",
    solution: "Federation polish: ported InboundTracker to src/components, built SponsorEmbed client component with suppress map for /checkout, /cart, /admin, /account, /portal. Added Org JSON-LD, metadataBase, sitemap, robots, llms.txt, Satori-safe OG. Pantheon CEO seeded with Rockefeller lens.",
    systems: [
      { layer: "Engineering", what: "Existing Next 16.1.6 + React 19.2.3 e-commerce app. Stripe + Supabase + Resend + framer-motion + recharts + tiptap stack untouched." },
      { layer: "Federation overlay", what: "InboundTracker + SponsorEmbed mounted in src/app/layout.tsx. Suppress map keeps cross-promo OUT of commerce + account paths so it never competes for purchase attention." },
      { layer: "JSON-LD + SEO", what: "Org schema, metadataBase=https://secretimperium.com, canonical, openGraph fallback images. Sitemap covers /, /28principles, /shop, /newsletter, /portal. Robots disallows /api, /admin, /account, /checkout, /cart, /portal/private." },
      { layer: "Analytics", what: "/api/inbound/imperium/{events,leads,newsletter_events} on Supabase (3 tables seeded via add_sitanim_imperium_tenants migration)." },
    ],
    agenticStack: [
      "Imperium CEO seeded with Rockefeller lens (vertical integration, systems thinking).",
      "Cross-promo creative imperium @ base_weight 3.5 — second-highest after sitanim.",
      "Sponsor embed suppressed on commerce paths — protects checkout conversion.",
      "Inbound newsletter signups flow to inbound_imperium_newsletter_events (cross-attribution-ready).",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-05",
  },

  // ────────────── Realm I — Operator · AI CEO ──────────────
  {
    slug: "rene-laveau",
    brand: "Rene Laveau",
    domain: "renelaveau.com",
    url: "https://renelaveau.com",
    inboundSlug: "rene",
    realm: 1,
    role: "Builder · Recording artist",
    status: "live",
    pantheonArchetype: "Builder",
    pantheonCEO: null,
    tagline: "Recording artist. Society of the Silver Line. Built end-to-end as a federation reference build.",
    problem: "Artist needed a cinematic personal-brand site with EPK, tour page, newsletter (Sacred Letter), and an audio widget — plus federation distribution from day one.",
    solution: "Bespoke Next 15 codebase, ~17 components including AudioWidget / Constellation / StarField / SigilEye / SilverLineForm / sponsor block. Cinzel + Italianno typography. Custom dark cosmic palette. Sacred Letter newsletter with RSS + JSON Feed. JSON-LD Person / MusicGroup / Event / FAQ / MusicRelease / Breadcrumb.",
    systems: [
      { layer: "Engineering", what: "Next 15 + React 19. ~17 bespoke components. Custom RSS + JSON Feed endpoints." },
      { layer: "Pages", what: "Home + EPK + Tour + Sacred Letter newsletter + may-15 event page + hvnrth + about + dashboard." },
      { layer: "Design", what: "Bespoke dark cosmic + Cinzel + Italianno typography + branded star/sigil animation system." },
      { layer: "SEO + JSON-LD", what: "Person + MusicGroup + Event + FAQ + MusicRelease + Breadcrumb. Sitemap, robots, llms.txt, Satori-safe OG." },
      { layer: "Analytics pipeline", what: "Custom /api/analytics → omnileadsagi.com inbound API → inbound_rene_* tables." },
      { layer: "Federation integration", what: "Sponsor banner on Sacred Letter posts. Footer cross-promo embed. Pantheon CEO seat reserved." },
      { layer: "Ops", what: "Vercel project bound, Namecheap DNS configured, SSL, OG/Twitter images, RSS/JSON feeds." },
    ],
    agenticStack: [
      "Inbound_rene_events / leads / newsletter_events all writing — 315+ events captured to date.",
      "Sponsor block on Sacred Letter posts cycles federation creatives.",
      "Federation referral capture in lib/analytics.ts envelope() ready to attribute inbound traffic.",
      "Pantheon CEO seat reserved (not yet seeded).",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-05",
  },
  {
    slug: "cps",
    brand: "Psych & Custody Evaluations",
    domain: "psychandcustodyevaluations.com",
    url: "https://psychandcustodyevaluations.com",
    inboundSlug: "cps",
    realm: 1,
    role: "Operator · AI CEO",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: "CPS CEO",
    tagline: "Forensic psychology + custody evaluations across Utah. Trusted by attorneys, courts, and families.",
    problem: "Forensic-services operator with strong professional reputation but no intake infrastructure — inquiries scattered across email, voicemail, and three forms with no follow-up SLA.",
    solution: "Federation site + InboundTracker → /api/inbound/cps/* → AI CEO routing. Every inquiry classified, prioritized, and routed inside 60 seconds. /book-consultation with service-list dropdown.",
    systems: STANDARD_SYSTEMS,
    agenticStack: STANDARD_AGENTIC,
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2025-12",
  },
  {
    slug: "leifson-built",
    brand: "Leifson Built",
    domain: "leifsonbuilt.com",
    url: "https://leifsonbuilt.com",
    inboundSlug: "leifson",
    realm: 1,
    role: "Operator · AI CEO",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: "Leifson CEO",
    tagline: "Custom decks and basements built across the Wasatch Front. Booked by the agentic stack.",
    problem: "Strong word-of-mouth, weak organic discovery. Service queries owned by aggregator brands instead of the operator.",
    solution: "Federation site + branded SEO + GEO satellite at utahdeckandbasementremodel.com (6 city-service pages) + cross-attributed CTAs back to leifsonbuilt.com.",
    systems: STANDARD_SYSTEMS,
    agenticStack: [
      ...STANDARD_AGENTIC,
      "GEO satellite at utahdeckandbasementremodel.com routes city-service traffic with full UTM attribution back to this domain.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2025-11",
  },
  {
    slug: "youngs-cabinet",
    brand: "Youngs Cabinet Refinishing",
    domain: "youngscabinetrefinishing.com",
    url: "https://youngscabinetrefinishing.com",
    inboundSlug: "youngs",
    realm: 1,
    role: "Operator · AI CEO",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: "Youngs CEO",
    tagline: "Cabinet renewal at scale. Renew before you remodel.",
    problem: "Operator competing in a remodel-first category needed messaging that captured the 'refinish, don't replace' value proposition + funnel that converted educational traffic.",
    solution: "Federation site + before/after-led hero + newsletter with refinish-vs-remodel content + AI CEO that reads inbound for high-intent keywords.",
    systems: STANDARD_SYSTEMS,
    agenticStack: STANDARD_AGENTIC,
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2025-12",
  },
  {
    slug: "love-thy-barber",
    brand: "Love Thy Barber",
    domain: "lovethybarber.shop",
    url: "https://lovethybarber.shop",
    inboundSlug: "ltb",
    realm: 1,
    role: "Operator · LTB only with order tracking",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: "LTB CEO",
    tagline: "The chair, the craft, and a back-office that runs itself.",
    problem: "Solo barber needed a back-office that handled bookings, products, and customer comms without an admin assistant.",
    solution: "Federation site + booking flow + product catalog (the only federation site with inbound_ltb_orders table). Cart, checkout, customer accounts.",
    systems: STANDARD_SYSTEMS,
    agenticStack: [
      ...STANDARD_AGENTIC,
      "inbound_ltb_orders unique among federation tenants — order-aware analytics + revenue rollup in /dashboard.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2025-10",
  },
  {
    slug: "taniela-fiefia",
    brand: "Taniela Fiefia",
    domain: "tanielafiefia.com",
    url: "https://tanielafiefia.com",
    // No inbound_taniela_* tenancy provisioned yet — set a slug here
    // once the analytics tables are created to light up live metrics.
    inboundSlug: null,
    realm: 1,
    role: "Operator · AI CEO · Concrete + mentorship",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: null,
    tagline: "Salt Lake City concrete contractor + contractor mentor — one bespoke Next.js site running two funnels: local quote intake and the 100K Concrete Mentorship.",
    problem: "A premium concrete contractor (driveways, patios, stamped flatwork across the Wasatch Front) needed a site that both converts local quote requests AND runs a separate mentorship funnel for contractors scaling to $100k/mo. Template builders can't do per-city local SEO, instant quote intake, and a second application funnel under one brand.",
    solution: "Bespoke Next.js operator site fronting both funnels: primary concrete funnel (services, per-city service-area pages, instant pricing calculator, get-a-quote intake, gallery, reviews, quote cards) and a secondary 100K Concrete Mentorship funnel (program page + application). Media kit, branded newsletter, resources hub, and member accounts on top. AI CEO layer routes inbound quotes + mentorship applications; LocalBusiness JSON-LD + per-city pages own the Salt Lake / Wasatch Front local search surface.",
    systems: [
      { layer: "Engineering", what: "Next.js + React custom codebase. Brand config single-source-of-truth (lib/brand.ts) driving both the concrete + mentorship funnels." },
      { layer: "Pages", what: "Home, services, per-city service-area/[city] pages, instant pricing-calculator, get-a-quote, gallery, reviews, quote-cards, media-kit, resources/[slug], mentorship + mentorship/apply, newsletter, accounts (signup/login/account), admin." },
      { layer: "Design", what: "Bespoke brand identity + design system — premium contractor look, mobile-first, custom components throughout (not a template)." },
      { layer: "SEO + JSON-LD", what: "LocalBusiness structured data, data-driven per-city service-area pages for Salt Lake + the Wasatch Front, sitemap, robots, llms.txt, Satori-safe OG." },
      { layer: "Lead capture", what: "Get-a-quote + pricing-calculator + mentorship application funnels POST to API routes → CRM mirror + Resend notifications (real human sender, never noreply@)." },
      { layer: "Federation integration", what: "Cross-promo embed + sponsor surface; inbound analytics tenancy ready to provision." },
      { layer: "Ops", what: "Vercel project bound, DNS + SSL, OG/Twitter images, newsletter on a verified domain." },
    ],
    agenticStack: [
      "Inbound quote routing + classification on every get-a-quote / pricing-calculator submit.",
      "Mentorship application capture + fit-scoring on every mentorship/apply submit, routed separately from concrete leads.",
      "First-response SLA tracking once the inbound tenancy is provisioned.",
      "Per-city content prompts (Salt Lake + Wasatch Front service areas) tuned seasonally by the AI CEO.",
      "Council Codex obeyed on every reasoning cycle — name-scrub, continuous execution, no-cron, etc.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-06",
  },
  {
    slug: "phoenix-exteriors",
    brand: "Phoenix Exteriors",
    domain: "phoenixexteriors.com",
    url: "https://phoenixexteriors.com",
    inboundSlug: "phoenix",
    realm: 1,
    role: "Operator · AI CEO",
    status: "live",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: "Phoenix CEO",
    tagline: "Roofing, siding, gutters. Built for storm-damage seasonality + steady inbound.",
    problem: "Storm-damage seasonal business with high-intent traffic concentrated in narrow windows + zero off-season conversion infrastructure.",
    solution: "Federation site + lead routing + AI CEO layer. Sponsor block surfaces partner products to off-season visitors so attention always converts to something.",
    systems: STANDARD_SYSTEMS,
    agenticStack: STANDARD_AGENTIC,
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-04",
  },
  {
    // Prime IV Sandy — combined Jaime build. Two delivered sites
    // under one engagement: the operator storefront at
    // primeivsandy.com AND the full Live Better On The Drip
    // podcast website + infrastructure at livebetteronthedrip.com
    // (its own Next.js codebase, episode CMS, transcript pipeline,
    // newsletter, distribution to Spotify / Apple / YouTube). Both
    // share the inbound_prime_iv_* tenancy so analytics roll up
    // across surfaces and the Pantheon CEO can route audience
    // between them.
    //
    // 2026-05-25 update (this commit): bumped from in_progress →
    // live and from $22k–$30k → $50k–$80k+ to reflect that the
    // engagement actually shipped both sites + the cross-
    // attribution + the AI CEO layer on top. The podcast is no
    // longer described as an "embed" on the operator site — it's
    // a first-class delivered surface with its own production
    // infrastructure. The standalone live-better-on-the-drip
    // case-study entry below stays put as the podcast-brand-only
    // view; this entry is the combined dual-surface story.
    slug: "prime-iv-sandy",
    brand: "Prime IV Sandy",
    // Headline asset is the LIVE personal-brand podcast, not the operator
    // site (which is still on its Vercel preview ahead of the
    // primeivsandy.com cutover). domain/url point at the podcast so the
    // hero "View Asset" button + the index "Visit Now" both open the live
    // surface. The operator site is surfaced as featuredAssetCard below.
    domain: "livebetteronthedrip.com",
    url: "https://livebetteronthedrip.com",
    primaryCtaLabel: "View Asset",
    headlineMetric: { value: "70%", label: "Reduction in lost leads" },
    featuredAssetCard: {
      title: "Prime IV Sandy — operator storefront",
      description:
        "The companion build: a hyper-personalized Next.js 15 site fronting the Sandy franchise. Jaime Bond as the face (portrait, signature, owner letter), the full 25+ drip menu with goal-based filters, a 3-tier membership comparison, the $85 intro offer above the fold, RN-on-staff trust signals, Booker on every page, and Sandy-local SEO (LocalBusiness + MedicalBusiness JSON-LD). Currently on its Vercel preview ahead of the primeivsandy.com cutover.",
      buttonLabel: "Visit Asset",
      url: "https://prime-iv-sandy.vercel.app",
    },
    inboundSlug: "prime_iv",
    realm: 1,
    role: "Operator · AI CEO + podcast engine",
    status: "live",
    pantheonArchetype: "Operator (mortal tier) · Storyteller blend",
    pantheonCEO: "Prime IV Sandy CEO",
    tagline: "Two sites, one Jaime brand — primeivsandy.com (Sandy operator storefront) + livebetteronthedrip.com (Live Better On The Drip podcast + full audience-engine infrastructure) shipped as one combined federation engagement.",
    problem: "Three deficits to close at once. (1) The live primeivsandy.com was a thin LeadConnector funnel — no menu depth, no team page, no Sandy-specific story; corporate franchise tools optimize for franchisee parity, not local conversion. (2) Live Better On The Drip existed as a podcast feed but had no production website, no episode CMS, no transcript surface, no newsletter, no owned distribution layer — every download was downstream of platform algorithms and died on the feed. (3) Even if both surfaces existed, there was no cross-attribution between the IV business and the show, so podcast audience couldn't be measured as a paying-customer pipeline and IV walk-ins couldn't be measured as a listener pipeline.",
    solution: "Combined dual-surface federation build delivered as one engagement. SURFACE 1 — primeivsandy.com: bespoke Next.js 15 site leading with Jaime as the face (portrait, signature, owner letter, BYU + franchise-mentor backstory, embedded IG reel) and Sandy as the local hook (Snowbird recovery, Hale Centre opening-night glow, Cottonwood Heights lifestyle). Full 25+ drip menu with goal-based filters, 3-tier membership comparison, $85 intro offer above the fold, RN-on-staff trust signals, Booker embed on every page, sticky mobile CTA, LocalBusiness + MedicalBusiness JSON-LD. SURFACE 2 — livebetteronthedrip.com: full podcast website with its own Next.js codebase, episode CMS, transcript indexing pipeline, branded newsletter infrastructure, Spotify / Apple / YouTube distribution wiring, guest pipeline, sponsor-slot scaffold. CROSS-LAYER: inbound_prime_iv_* tenancy carries lead capture + events from both surfaces; dual-surface attribution collapses listener + walk-in into one Jaime-brand lead; the Pantheon CEO routes audience between the two (podcast listener → $85 intro / IV walk-in → episode subscribe) and tunes seasonal Sandy-local content prompts.",
    systems: [
      ...STANDARD_SYSTEMS,
      { layer: "Booker integration", what: "go.booker.com/PrimeIVSandy iframe on /book + CTA buttons across every page. Booking source-attribution wired into inbound_prime_iv_events with per-source-page granularity." },
      { layer: "Podcast site (own codebase)", what: "livebetteronthedrip.com — its own Next.js 15 production site with bespoke design, episode list, individual episode pages, About / Guest / Sponsor surfaces, OG + Twitter cards per episode. Not a YouTube channel page or a Squarespace template — a real production site that the show owns." },
      { layer: "Episode CMS + transcript pipeline", what: "Per-episode content model (title, show notes, transcript, guest, links, art). Audio pulled via RSS; transcripts indexed for on-site search and for AI-CEO ingestion so episodes become a permanent retrieval corpus the Sandy CEO can quote from." },
      { layer: "Newsletter infrastructure", what: "Branded newsletter capture on both sites, episode-drop send templates, federation cross-promo slot, double-opt-in flow. Subscriber list is owned by Jaime, not rented from a platform." },
      { layer: "Cross-surface attribution", what: "Universal tracker present on both domains writes to inbound_prime_iv_events with a `surface` field (sandy / podcast). Sessions that hit both within a window collapse to one lead with a `dual_surface` tag, so the operator side can measure podcast-driven bookings and the podcast side can measure IV-driven listens." },
      { layer: "Local SEO", what: "LocalBusiness + MedicalBusiness JSON-LD with full NAP, hours, geo, aggregateRating (5★ / 282 reviews) on the Sandy site. PodcastSeries + PodcastEpisode JSON-LD on the podcast site so episodes index in Google + Apple discovery. Every Sandy page H1 + meta name-checks Sandy / Sandy, UT." },
    ],
    agenticStack: [
      ...STANDARD_AGENTIC,
      "Booker click-intent capture — every Book-$85 click logs to inbound_prime_iv_events with source page, so the CEO can rank which surface (home / drips / podcast / meet-jaime) drives the most bookings.",
      "Cross-surface attribution between primeivsandy.com and livebetteronthedrip.com — visitors who hit both inside a session collapse to one prime_iv lead with a `dual_surface` tag, exposing the podcast→IV and IV→podcast funnels.",
      "Sandy-local content prompts (Snowbird recovery / Hale opening night / Cottonwood Heights families) tuned seasonally by the Prime IV Sandy CEO.",
      "Episode-prep agent — pulls upcoming guest context, drafts show notes, generates social cuts, and writes the episode-drop newsletter ahead of each release.",
      "Transcript-indexed retrieval — every episode's transcript is embedded into the Sandy CEO's corpus so the AI can quote Jaime's own words back to local visitors asking IV-related questions.",
      "Guest pipeline — inbound guest pitches land in a structured Supabase table; the CEO scores fit, drafts the reply, and queues calendar holds for confirmed bookings.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "federation",
    marketTierLabel: "Ultimate Power · Sovereign Empire",
    buildPriceRange: "$50k – $80k+",
    liveSince: "2026-05",
  },
  {
    // Case-study reframed 2026-05-19: the dashboard client on this
    // tenancy is Jaime's "Live Better On The Drip" personal-brand
    // podcast, not the Prime IV Hydration franchise that hosts the
    // tables. The inbound_prime_iv_{leads,events} tenancy stays
    // (livebetteronthedrip.com writes there); the case-study brand /
    // domain / framing flips to lead with the podcast.
    //
    // 2026-05-25: paired with the new prime-iv-sandy operator case
    // study (entry directly above). The two surfaces share the
    // inbound_prime_iv_* tenancy so each case-study page shows
    // combined Jaime-brand analytics. Together they're the Prime
    // IV story — Sandy is the storefront, this is the audience.
    slug: "live-better-on-the-drip",
    brand: "Live Better On The Drip",
    domain: "livebetteronthedrip.com",
    url: "https://livebetteronthedrip.com",
    inboundSlug: "prime_iv",
    realm: 1,
    role: "Personal-brand podcast · audience engine",
    status: "live",
    pantheonArchetype: "Storyteller (mortal tier)",
    pantheonCEO: "Live Better CEO",
    tagline: "Jaime's personal-brand podcast — weekly show, newsletter, and federation distribution wired into the broader Omni AI portfolio. Paired with the Prime IV Sandy operator site as one Jaime-brand content engine.",
    problem: "Podcast brand needed real channel infrastructure (site, AI CEO routing, branded newsletter, federation cross-promo attribution) so every episode could compound across the federation instead of dying on the platform feed. And without an operator surface to land podcast traffic back into a paying business, every download was a dead end.",
    solution: "Federation site under the podcast brand. Cross-promo embed routes show audience back into the network. Inbound_prime_iv_ tenancy carries lead capture, page-view events, and source attribution from every CTA placement. The companion Prime IV Sandy operator build (primeivsandy.com) embeds this podcast directly on the homepage + dedicated /podcast route, so listeners flow into the IV business and IV visitors flow into the show — one funnel, two surfaces.",
    systems: STANDARD_SYSTEMS,
    agenticStack: STANDARD_AGENTIC,
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$18k – $25k",
    liveSince: "2026-03",
  },

  // ────────────── Realm I — Newsrooms ──────────────
  {
    slug: "utah-main-street",
    brand: "Utah Main Street",
    domain: "utahmainstreet.com",
    url: "https://utahmainstreet.com",
    inboundSlug: "mainst",
    realm: 1,
    role: "Newsroom",
    status: "live",
    pantheonArchetype: "Cartographer (Dante lens)",
    pantheonCEO: null,
    tagline: "The state's main-street pulse, delivered weekly.",
    problem: "Local commerce coverage in Utah is fragmented across dozens of legacy outlets. No single weekly digest synthesizing main-street activity.",
    solution: "Federation newsroom site with weekly issue cadence, automated content workflow, sponsor block, and federation cross-promo to drive cross-readership.",
    systems: STANDARD_SYSTEMS,
    agenticStack: [
      ...STANDARD_AGENTIC,
      "Newsroom issue logging via newsroom_issue_log table.",
      "Cross-promo to sister newsrooms (Beehive, Wasatch Post).",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$15k – $22k",
    liveSince: "2026-04",
  },
  {
    slug: "beehive-biz-pulse",
    brand: "Beehive Biz Pulse",
    domain: "beehivebizpulse.com",
    url: "https://beehivebizpulse.com",
    inboundSlug: "beehive",
    realm: 1,
    role: "Newsroom",
    status: "live",
    pantheonArchetype: "Cartographer (Dante lens)",
    pantheonCEO: null,
    tagline: "What Utah business is doing, who's winning, who's pivoting.",
    problem: "Utah-focused business coverage was either deep-pocketed-PR-driven or non-existent. No outlet treating regional founders as the audience.",
    solution: "Federation newsroom with founder-centric framing, weekly cadence, federation cross-promo to surface the network effect.",
    systems: STANDARD_SYSTEMS,
    agenticStack: [
      ...STANDARD_AGENTIC,
      "Newsroom issue logging via newsroom_issue_log table.",
      "Cross-promo to sister newsrooms (UMS, Wasatch Post).",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$15k – $22k",
    liveSince: "2026-04",
  },
  {
    slug: "wasatch-post",
    brand: "The Wasatch Post",
    domain: "thewasatchpost.com",
    url: "https://thewasatchpost.com",
    inboundSlug: "wasatch",
    realm: 1,
    role: "Newsroom",
    status: "live",
    pantheonArchetype: "Cartographer (Dante lens)",
    pantheonCEO: null,
    tagline: "Mountain-front politics, culture, and quiet wealth.",
    problem: "Quality regional journalism in the Wasatch corridor concentrated in two legacy outlets. Founder-to-founder + culture coverage missing.",
    solution: "Federation newsroom with investigative + culture mix, weekly issue rhythm, federation cross-promo for cross-readership.",
    systems: STANDARD_SYSTEMS,
    agenticStack: [
      ...STANDARD_AGENTIC,
      "Newsroom issue logging via newsroom_issue_log table.",
      "Cross-promo to sister newsrooms (UMS, Beehive).",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js",
    buildPriceRange: "$15k – $22k",
    liveSince: "2026-04",
  },

  // Channel-partner OTD case-study entry removed 2026-05-19 — it
  // collided on slug "live-better-on-the-drip" with the renamed
  // prime_iv entry above, and its inboundSlug pointed at the
  // empty inbound_otd_* tables (the actual livebetteronthedrip.com
  // data lives in inbound_prime_iv_*). The renamed entry above
  // is now the single canonical Live Better case-study card.

  // ────────────── Realm I — N.3 funnels ──────────────
  {
    slug: "agiarena",
    brand: "AGI Arena",
    domain: "agiarena.online",
    url: "https://agiarena.online",
    inboundSlug: null,
    // Public Pantheon viewer surfaces the cluster's combined activity:
    // it's a window into the federation, so the dashboard combines
    // every Realm I + II tenant.
    combinedSlugs: ["omnileads", "sitanim", "imperium", "rene", "ltb", "leifson", "youngs", "cps"],
    realm: 1,
    role: "Public Pantheon spectator",
    status: "live",
    pantheonArchetype: "Plato (visionary lens)",
    pantheonCEO: null,
    tagline: "Public spectator stream of the Pantheon. Live ELO. Real agents. Real outcomes.",
    problem: "The Pantheon ran inside the dashboard but had no public face. Anyone wanting to see how a society of agents actually works had no way in.",
    solution: "Single-page Next 15 site that fetches /api/council/leaderboard from omnileadsagi.com on 60s revalidate, groups agents by tier (sentinel → council → patron → competitor → recruit), color-coded. CTAs to /oracle + sponsor-an-agent.",
    systems: [
      { layer: "Engineering", what: "Next 15 + React 19 + Tailwind 4 beta. Server component fetches federation leaderboard with 60s revalidate." },
      { layer: "Design", what: "Dark cosmic palette aligned with /oracle. Tier-color classes (council=gold, patron=purple, competitor=cyan, recruit=emerald, sentinel=red)." },
      { layer: "SEO", what: "Sitemap, robots, Satori-safe OG, twitter-image. Title 'AGI Arena — Pantheon Live'." },
      { layer: "Federation", what: "federation-ad-footer mounted with data-slug='agiarena'." },
    ],
    agenticStack: [
      "Live consumes /api/council/leaderboard — surfaces 32 active agents.",
      "Pure spectator — no inbound writes (read-only on the federation).",
      "Cross-promo footer drives traffic INTO the federation.",
    ],
    pricing: TEMPLATE_PRICING,
    marketTier: "template",
    marketTierLabel: "Tier 1 · N.3 funnel scaffold",
    buildPriceRange: "$2.5k – $4.5k",
    liveSince: "2026-05",
  },
  {
    slug: "utah-deck",
    brand: "Utah Deck & Basement Remodel",
    domain: "utahdeckandbasementremodel.com",
    url: "https://utahdeckandbasementremodel.com",
    inboundSlug: "leifson",
    // Leifson satellite — funnel work also touches youngs (cabinet
    // upsell) on the way through.
    combinedSlugs: ["youngs"],
    realm: 1,
    role: "Leifson satellite · GEO funnel",
    status: "live",
    pantheonArchetype: "Carnegie (scale lens)",
    pantheonCEO: null,
    tagline: "6 GEO city pages routing all CTAs to leifsonbuilt.com with full attribution.",
    problem: "Service-area SEO traffic for decks + basements was being captured by aggregators rather than Leifson directly. Needed a satellite that ranked locally and bounced traffic back to the operator.",
    solution: "6-city dynamic [city] route (Salt Lake City, Park City, Lehi, Draper, Sandy, Bountiful). LocalBusiness JSON-LD per city with parentOrganization=Leifson Built. Every CTA → leifsonbuilt.com?ref=utah-deck&utm_*.",
    systems: [
      { layer: "Engineering", what: "Next 15 + React 19. Dynamic [city] route with generateStaticParams over CITIES array." },
      { layer: "Pages", what: "Home (city directory grid) + 6 per-city landing pages with Decks + Basements split into two CTAs." },
      { layer: "JSON-LD", what: "LocalBusiness schema per city with parentOrganization linking to Leifson Built." },
      { layer: "Attribution", what: "All CTAs append ref=utah-deck + utm_source/medium/campaign params." },
    ],
    agenticStack: [
      "Federation referral capture mounts on Leifson's tracker so utah-deck → leifson conversions write cross_brand_referrals.",
      "Cross-promo footer mounted with data-slug='leifson' so referral context inherits.",
    ],
    pricing: TEMPLATE_PRICING,
    marketTier: "template",
    marketTierLabel: "Tier 1 · N.3 satellite funnel",
    buildPriceRange: "$2.5k – $4.5k",
    liveSince: "2026-05",
  },
  {
    slug: "omnileads-shop",
    brand: "Omni Leads Shop",
    domain: "omnileads.shop",
    url: "https://omnileads.shop/merch",
    inboundSlug: "omnileads",
    // Federation merch — every brand on the merch wall (Imperium hoodie,
    // Pantheon mug, Live Better tee) routes referral traffic back into
    // its origin tenant. Combined view shows the merch funnel reach.
    combinedSlugs: ["imperium", "sitanim", "rene", "ltb"],
    realm: 1,
    role: "Federation merch",
    status: "live",
    pantheonArchetype: "Disney (experience lens)",
    pantheonCEO: null,
    tagline: "Federation merch. Hoodies, prints, mugs, notebooks. Imperium / Pantheon / Oracle / Federation lines.",
    problem: "Federation needed a tangible artifact loop — wearables and prints that turn members into walking distribution.",
    solution: "/merch page on the existing Omni Leads scaffold. 6 product cards across 4 product lines. Stripe payment links (placeholder until products configured).",
    systems: [
      { layer: "Engineering", what: "Page added to existing Omni Leads Next.js scaffold (non-disruptive)." },
      { layer: "Product roster", what: "Imperium hoodie + cap, Pantheon mug, Oracle print + notebook, Federation tee." },
      { layer: "Federation", what: "Federation-ad-footer mounted. Tracker on omnileads slug captures merch traffic." },
    ],
    agenticStack: [
      "Stripe products + payment links pending operator configuration.",
      "Future: revenue split to feature-line operators (Imperium hoodie revenue → Imperium tenant via cross_brand_referrals).",
    ],
    pricing: [
      { line: "Merch surface scaffold", price: "$1,500 one-time", note: "Page added to existing scaffold; product cards templated." },
      { line: "Stripe products + fulfillment setup", price: "$500 one-time", note: "Operator-provided product specs + fulfillment partner." },
      { line: "Revenue split to operators", price: "Variable", note: "Per-product split for cross-promo participants." },
    ],
    marketTier: "themed",
    marketTierLabel: "N.3 · merch surface on existing scaffold",
    buildPriceRange: "$1.5k – $2k addition",
    liveSince: "2026-05",
  },
  {
    slug: "ai-digital-marketing",
    brand: "AI Digital Marketing Solution",
    domain: "aidigitalmarketingsolution.com",
    url: "https://aidigitalmarketingsolution.com",
    inboundSlug: "omnileads",
    // Case-study funnel that walks prospects through CPS, Leifson, and
    // Phoenix proof points before pitching the strategy call. The 3
    // referenced clients' analytics fold into this node's combined view.
    combinedSlugs: ["cps", "leifson", "phoenix"],
    realm: 1,
    role: "Omni AI case-study funnel",
    status: "live",
    pantheonArchetype: "Hephaestus (smith lens)",
    pantheonCEO: null,
    tagline: "Three operators. One playbook. Real outcomes. CTA → omnileadsagi.com strategy call.",
    problem: "Sales conversations needed a single shareable URL that proved the federation playbook works on real operators.",
    solution: "Single-page case-study funnel showcasing CPS / Leifson / Phoenix. Every CTA routes to omnileadsagi.com strategy call with attribution.",
    systems: [
      { layer: "Engineering", what: "Single-page Next 15 + React 19. Three case-study cards with consistent Problem / System Built / Outcome triad." },
      { layer: "Attribution", what: "All CTAs route to /book/omni?ref=aidigital&utm_source=aidigital&utm_medium=case-study&utm_campaign=strategy-call." },
      { layer: "Federation", what: "Federation-ad-footer mounted. Sponsor embed inherits omnileads slug." },
    ],
    agenticStack: [
      "Pure top-of-funnel — designed to be sent to prospects.",
      "Future: per-case dynamic OG cards.",
    ],
    pricing: TEMPLATE_PRICING,
    marketTier: "template",
    marketTierLabel: "N.3 · top-of-funnel case-study site",
    buildPriceRange: "$2.5k – $4.5k",
    liveSince: "2026-05",
  },
  {
    slug: "seo-ppc-marketing",
    brand: "SEO & PPC Marketing",
    domain: "seoandppcmarketing.com",
    url: "https://seoandppcmarketing.com",
    inboundSlug: null,
    // 14 short-link redirects route attribution into 7 federation
    // tenants. Combined dashboard surfaces aggregate redirect-driven
    // referrals into each.
    combinedSlugs: ["cps", "leifson", "youngs", "ltb", "phoenix", "imperium", "sitanim"],
    realm: 1,
    role: "Branded short-link redirect",
    status: "live",
    pantheonArchetype: "OmniClaw (integrations lens)",
    pantheonCEO: null,
    tagline: "Branded short-link directory. Every hop appends full attribution before 302-ing to canonical.",
    problem: "Paid traffic + agent outreach needed memorable short URLs that preserved attribution through the redirect.",
    solution: "Edge route handler at /[slug] mapping 14 short codes (cps / leifson / youngs / ltb / phoenix / imperium / sitani / sitanim / omni / oracle / rene / prime / ums / beehive / wasatch). 302 with ref + utm_* + fed_v=1 always appended.",
    systems: [
      { layer: "Engineering", what: "Edge runtime route handler. ~30 lines of redirect logic + landing page directory." },
      { layer: "Attribution", what: "Always appends ref=spc-redirect + utm_source=seo-ppc-marketing + utm_medium=branded-redirect + utm_campaign=spc-<slug> + fed_v=1." },
      { layer: "Directory", what: "Public landing page lists every short link with brand + tagline." },
    ],
    agenticStack: [
      "Pure redirect domain — no inbound writes; downstream slug captures the referral.",
      "Future: per-redirect click counter via Vercel Edge Config.",
    ],
    pricing: [
      { line: "Branded redirect domain", price: "$1,500 one-time", note: "Edge route handler + landing directory + DNS wiring." },
      { line: "Hosting", price: "$50 / mo", note: "Negligible Vercel + Namecheap cost." },
    ],
    marketTier: "template",
    marketTierLabel: "N.3 · branded redirect surface",
    buildPriceRange: "$1.5k one-time",
    liveSince: "2026-05",
  },

  // ────────────── Realm I — In-flight + portfolio ──────────────
  {
    slug: "alira",
    brand: "Alira",
    domain: "alira.live",
    url: "https://alira.live",
    inboundSlug: "alira",
    realm: 1,
    role: "Personal Brand · AI CEO",
    status: "live",
    pantheonArchetype: "Plato (visionary lens)",
    pantheonCEO: null,
    tagline: "Spiritual leadership platform. AI CEO layer in place; public positioning in flight.",
    problem: "Alira has the AI CEO layer wired through Interlinked but the public-facing positioning + funnel hasn't locked in.",
    solution: "Federation tenancy provisioned (alira slug + inbound tables). AI CEO already running through Interlinked. Public Tier 3 build to follow once positioning locks.",
    systems: [
      { layer: "Federation tenancy", what: "alira slug registered in INBOUND_SLUGS. inbound_alira_{events,leads,bookings,newsletter_events,orders} tables provisioned." },
      { layer: "Interlinked AI CEO", what: "Per-AGENTS.md, Alira AI CEO layer is built into Interlinked. Telegram bot + ops loops active." },
      { layer: "Public site", what: "Pending positioning lock." },
    ],
    agenticStack: [
      "Interlinked AI CEO loop active — autonomous decision-making per Three Pillars (Memory / Decision Logic / Self-Improvement).",
      "Telegram bot operational.",
      "9 events captured to date in inbound_alira_events.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js (when positioning locks)",
    buildPriceRange: "$18k – $25k",
    liveSince: null,
  },
  {
    slug: "north-peak-roofing",
    brand: "North Peak Roofing",
    domain: "northpeakroof.com",
    url: "https://northpeakroof.com",
    inboundSlug: null,
    realm: 1,
    role: "AI CEO layer",
    status: "in_progress",
    pantheonArchetype: "Operator (mortal tier)",
    pantheonCEO: null,
    tagline: "Roofing operator with a CEO layer learning the trade.",
    problem: "Roofing operator needed an AI CEO layer that could absorb their workflow and start running the back-office.",
    solution: "Interlinked AI CEO layer added per AGENTS.md. Public federation site + inbound tenancy pending operator handoff.",
    systems: [
      { layer: "Interlinked AI CEO", what: "Layer added per AGENTS.md. Decision loops + memory active." },
      { layer: "Public site", what: "Pending federation tenancy + Tier 3 build." },
    ],
    agenticStack: [
      "Interlinked AI CEO learning the operator's workflow.",
      "Federation onboarding queued.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js (when public site lands)",
    buildPriceRange: "$18k – $25k",
    liveSince: null,
  },
  {
    slug: "nikifellow",
    brand: "Nikifellow",
    domain: "nikifellow.com",
    url: "#",
    inboundSlug: "niki",
    realm: 1,
    role: "Forthcoming",
    status: "forthcoming",
    pantheonArchetype: null,
    pantheonCEO: null,
    tagline: "In design. Federation node forthcoming.",
    problem: "TBD — positioning in flight.",
    solution: "Federation tenancy reserved. Site build queued behind active operators.",
    systems: [
      { layer: "Federation tenancy", what: "niki slug reserved in INBOUND_SLUGS. inbound_niki_* tables provisioned." },
    ],
    agenticStack: [
      "Tables ready for traffic ingestion when public site ships.",
    ],
    pricing: TIER3_PRICING,
    marketTier: "bespoke",
    marketTierLabel: "Tier 3 · Bespoke Next.js (when commissioned)",
    buildPriceRange: "$18k – $25k",
    liveSince: null,
  },
];

export function getCaseStudy(slug: string): CaseStudy | null {
  return CASE_STUDIES.find((c) => c.slug === slug) ?? null;
}

export const CASE_STUDY_SLUGS = CASE_STUDIES.map((c) => c.slug);
