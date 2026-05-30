// Per-site briefs for the federation newsletter daily generator.
//
// Each entry describes the operator-owned site enough that Claude can write
// today's dispatch in its voice without us hand-editing every prompt. The
// brief also carries the business-owner email address — that's who receives
// the dispatched copy AFTER the operator approves the draft. Never use this
// address before approval.
//
// To onboard a new federation site, add an entry here and:
//   1. Copy lib/federation-sponsors.ts + components/federation-sponsors/SponsorRotation.tsx into the site repo
//   2. Scaffold app/newsletter/{page.tsx,[slug]/page.tsx} on the site
//   3. Add a Vercel cron entry on the site repo's vercel.json that POSTs
//      `https://omnileadsagi.com/api/federation-newsletter/generate-daily?site=<slug>&secret=$OMNI_FEDERATION_CRON_SECRET`

export type FederationNewsletterBrief = {
  /** Slug matches lib/case-studies.ts and the federation_newsletter_posts.site column. */
  site: string;
  /** Site's display name in operator-facing draft emails. */
  brandName: string;
  /** Public domain (no protocol). Used to build the published post URL. */
  domain: string;
  /** Short voice/persona descriptor — fed into the Claude prompt. */
  voice: string;
  /** Who this is written for — also fed to Claude. */
  audience: string;
  /** Niche / topical focus. Claude should stay inside this lane. */
  niche: string;
  /** Hard constraints — phrases or framings Claude should never produce. */
  doNotSay: string[];
  /**
   * Business owner email — the one human, besides the operator (Sita), who
   * receives the dispatched copy when the draft is approved. The operator
   * (sitanim8@gmail.com) is always implicitly cc'd.
   */
  businessOwnerEmail: string;
  /**
   * Optional override for the "From" identity on Resend sends. Defaults to
   * `dispatch@<domain>` so each site sends from its own subdomain. The
   * Resend account already has these domains verified.
   */
  fromEmail?: string;
};

export const FEDERATION_NEWSLETTER_BRIEFS: FederationNewsletterBrief[] = [
  {
    site: 'beehive-biz-pulse',
    brandName: 'Beehive Biz Pulse',
    domain: 'beehivebizpulse.com',
    voice: 'Tight, declarative, Utah-business pragmatic. No fluff, no hedging.',
    audience: 'Utah small-business owners (50–500 employees) tracking the local market.',
    niche: 'Utah commerce, hiring shifts, regulation moves, real-estate signals, supply-chain pulses.',
    doNotSay: [
      'crystal',
      'manifest',
      'sacred',
      'goddess',
      'vibes',
      'aligned',
      'energy work',
    ],
    businessOwnerEmail: 'beehivebizpulse@gmail.com',
  },
  {
    site: 'utah-main-street',
    brandName: 'Utah Main Street',
    domain: 'utahmainstreet.com',
    voice: 'Local-paper warm, neighborhood-first. Names matter, places matter.',
    audience: 'Utah residents who care about what is opening, closing, and shifting on their street.',
    niche: 'Local Utah businesses, openings, closings, events, mom-and-pop wins.',
    doNotSay: ['crystal', 'manifest', 'sacred', 'goddess'],
    businessOwnerEmail: 'utahmainstreet@gmail.com',
  },
  {
    site: 'wasatch-post',
    brandName: 'The Wasatch Post',
    domain: 'thewasatchpost.com',
    voice: 'Reported, sourced, with one editorial line at the end. Wasatch Front lens.',
    audience: 'Politically literate Wasatch Front readers — Salt Lake to Provo to Ogden.',
    niche: 'Wasatch Front news: legislature, courts, growth, public lands, water.',
    doNotSay: ['crystal', 'manifest', 'sacred', 'goddess', 'vibes'],
    businessOwnerEmail: 'thewasatchpost@gmail.com',
  },
  {
    site: 'live-better-on-the-drip',
    brandName: 'Live Better · On The Drip',
    domain: 'livebetterpodcast.com',
    voice: 'Conversational, vulnerable, show-host. Like a podcast cold-open in text.',
    audience: 'Listeners who came in through one of the show episodes; people reassembling a life.',
    niche: 'Mind-body integration, real interviews, the back-story to a guest, the manifesto in motion.',
    doNotSay: ['guru', 'masterclass', 'transformational journey'],
    businessOwnerEmail: 'livebetterpodcast@gmail.com',
  },
  {
    site: 'sitani-mafi',
    brandName: 'Sitani Mafi',
    domain: 'sitanimafi.live',
    voice: 'First-person operator. Builder writing to other builders. Short paragraphs.',
    audience: 'Founders, operators, people running systems alone.',
    niche: 'AI-native operating, federation building, Pantheon dispatches, builder field notes.',
    doNotSay: ['hustle', 'grind', 'crushed it'],
    businessOwnerEmail: 'sitanim8@gmail.com',
  },
  {
    site: 'imperium',
    brandName: 'Imperium',
    domain: 'secretimperium.com',
    voice: 'Esoteric, measured, a private letter from the order. No exclamation points.',
    audience: 'Members of the Imperium — operators in the inner orbit.',
    niche: 'Builder rites, the Pantheon, signals from the federation, member-only context.',
    doNotSay: ['guys', 'folks', 'newsletter', 'subscribe', 'click here'],
    businessOwnerEmail: 'secretimperium@gmail.com',
  },
  {
    site: 'leifson-built',
    brandName: 'Leifson Built',
    domain: 'utahdeckandbasementremodel.com',
    voice: 'Trade-pro, plainspoken, takes pride in finish work. Utah dialect.',
    audience: 'Utah homeowners considering a deck or basement project.',
    niche: 'Deck design, basement finishing, code, permits, real before/after stories.',
    doNotSay: ['unleash', 'transform your life', 'dream home'],
    businessOwnerEmail: 'leifsonbuilt@gmail.com',
  },
  {
    site: 'youngs-cabinet',
    brandName: 'Youngs Cabinet Refinishing',
    domain: 'youngscabinetrefinishing.com',
    voice: 'Craftsman to homeowner. Specific about technique, calm about cost.',
    audience: 'Utah homeowners considering refinishing vs. replacing their cabinets.',
    niche: 'Cabinet refinishing, color trends, sheen choice, project timelines, real jobs.',
    doNotSay: ['transform', 'wow factor', 'jaw-dropping'],
    businessOwnerEmail: 'youngscabinetrefinishing@gmail.com',
  },
  {
    site: 'love-thy-barber',
    brandName: 'Love Thy Barber',
    domain: 'lovethybarber.shop',
    voice: 'Barbershop steady. Brief, dry-humored, between-haircut chatter.',
    audience: 'Local clients and barbers in the shop community.',
    niche: 'Cuts, chair stories, product picks, neighborhood notes.',
    doNotSay: ['journey', 'unlock', 'elevate your look'],
    businessOwnerEmail: 'lovethybarber@gmail.com',
  },
  {
    site: 'phoenix-exteriors',
    brandName: 'Phoenix Exteriors',
    domain: 'phoenixexteriors.com',
    voice: 'Roofing-pro, weather-aware, fast on the read. Numbers when they help.',
    audience: 'Utah homeowners dealing with roof, siding, gutter, or storm-damage decisions.',
    niche: 'Roofing, siding, storm damage, insurance claims, real Utah jobs.',
    doNotSay: ['dream home', 'transform your exterior'],
    businessOwnerEmail: 'phoenixexteriors@gmail.com',
  },
];

export function getFederationBrief(
  site: string,
): FederationNewsletterBrief | null {
  return FEDERATION_NEWSLETTER_BRIEFS.find((b) => b.site === site) ?? null;
}

export const FEDERATION_OPERATOR_EMAIL = 'sitanim8@gmail.com';

// Federation case-study slug → omni_businesses.slug.
//
// The case-studies catalog (lib/case-studies.ts) and the omni_businesses
// table use DIFFERENT slug conventions for the same site. The pipeline
// always speaks the case-studies vocabulary (because that's what the
// federation_newsletter_posts.site column stores and what every per-
// site `<SponsorRotation host="…">` prop carries) but the canonical
// business-owner contact_email lives in the businesses table. This
// map bridges them.
//
// To onboard a new federation site:
//   1. Add an entry to FEDERATION_NEWSLETTER_BRIEFS above.
//   2. Make sure omni_businesses has a row with the corresponding slug.
//   3. Add the (federation-slug → business-slug) pair here.
//   4. Operator UPDATE's omni_businesses.contact_email when ready to
//      start dispatching to the owner; until then, the pipeline falls
//      back to operator-only with a [NO-OWNER-ON-FILE] subject prefix.
export const FEDERATION_TO_BUSINESS_SLUG: Record<string, string> = {
  'rene-laveau': 'rene',
  'cps': 'cps',
  'alira': 'alira',
  'beehive-biz-pulse': 'beehive',
  'utah-main-street': 'mainst',
  'wasatch-post': 'wasatch',
  'live-better-on-the-drip': 'otd',
  'sitani-mafi': 'sitanim',
  'imperium': 'imperium',
  'leifson-built': 'leifson',
  'youngs-cabinet': 'youngs',
  'love-thy-barber': 'ltb',
  'phoenix-exteriors': 'phoenix',
};

export function getBusinessSlugForFederationSite(
  federationSlug: string,
): string | null {
  return FEDERATION_TO_BUSINESS_SLUG[federationSlug] ?? null;
}
