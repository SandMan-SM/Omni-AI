// /lovethybarber/referral/info — long-form companion to /lovethybarber/referral.
// Was /lovethybarber/referral/full pre-2026-05-24; URL renamed for naming
// parity with /renelaveau/referral/info. A permanent redirect in
// next.config.mjs catches old /full links and 301s them here so
// shared URLs don't break.
//
// The shorter /lovethybarber/referral page is the teaser; this page
// carries the full breakdown (leverage callout, chip strip,
// open-market value table, Love Thy Barber's live-build proof card,
// distribution + community grid, pricing reveal modal with two
// cards, why-this-is-different grid, AES-256 final CTA, footer).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LoveThyBarberReferralInfoClient } from "./LoveThyBarberReferralInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/lovethybarber/referral/info`;

// Live Stripe payment links — dedicated Love Thy Barber product
// prod_Uc5rpu39zNZ2GF so the checkout brands as "…— Love Thy Barber
// Referral" and reporting separates from Alira:
//   - $3,000 one-time:   price_1TcrffE1uHPZaaHpkcbYWACq → plink_1TcrfuE1uHPZaaHpsz1okcCY
//   - $300/mo recurring: price_1TcrfaE1uHPZaaHpf9mdFGL4 → plink_1TcrfmE1uHPZaaHp3o9wAaSR
const PAY_FULL_URL = "https://buy.stripe.com/3cIdR9e1Q8uQ53h0lW9fW0o";
const PAY_DEPOSIT_URL = "https://buy.stripe.com/5kQeVde1Q3aw7bpgkU9fW0n";

const CASE_STUDY = {
  brand: "Love Thy Barber",
  domain: "lovethybarber.shop",
  url: "https://lovethybarber.shop",
  role: "Personal Brand · AI CEO",
  tagline:
    "Bespoke Next.js channel hub with the AI CEO layer routing inbound, a federated cross-promo embed, and newsletter distribution wired into the broader Omni AI portfolio.",
  shippedBullets: [
    "Custom Next.js codebase + design system, fully owned",
    "AI CEO layer for inbound routing + lead scoring",
    "Federation cross-promo embed driving organic referral traffic",
    "Branded Resend newsletter on a verified domain",
    "JSON-LD + edge-rendered OG for full search-surface coverage",
  ],
  caseStudyUrl: `${SITE_URL}/federation/case-studies/love-thy-barber`,
};

// Open-market value rows — aligned to the Rene referral so the
// two surfaces tell one consistent story. 5 fixed-dollar rows
// summing to $60,000 (vs the old per-line $/yr framing summing to
// $200K+).
const MARKET_RATES: { service: string; value: string }[] = [
  {
    service: "Bespoke Next.js federation site",
    value: "$15,000 · custom codebase, SEO, JSON-LD, edge OG",
  },
  {
    service: "AI CEO + inbound routing layer",
    value: "$15,000 · per-tenant intelligence, lead scoring",
  },
  {
    service: "Personal AI assistants",
    value: "$10,000 · 24/7 SMS / email / chat coverage",
  },
  {
    service: "Branded newsletter + automation",
    value: "$8,000 · Resend infra, drip sequences, sponsor block",
  },
  {
    service: "Federation cross-promo + GEO distribution",
    value: "$12,000 · placements across 16 partner brands",
  },
];
const MARKET_TOTAL = "$60K+";

const PRICING_OPTIONS = [
  {
    id: "deposit",
    label: "Secures your spot",
    price: "$300",
    cadenceTop: "down · $300/mo over 9 months",
    cadenceBottom: "This wave: only 50 businesses · cancel anytime if we don't ship",
    valueLine:
      "After your $300 clears we send a payment confirmation email with a one-click button to schedule your strategy meeting with our team. Slot is locked the moment payment lands.",
    payUrl: PAY_DEPOSIT_URL,
    cta: "Secure your spot · $300",
    featured: true,
  },
  {
    id: "full",
    label: "Pay in full",
    price: "$3,000",
    cadenceTop: "one-time · clean lock-in",
    cadenceBottom: "Single Stripe checkout · zero recurring billing",
    valueLine:
      "Pay the build out in one motion. Same deliverable, no monthly cadence to manage. Slot is locked the moment payment clears.",
    payUrl: PAY_FULL_URL,
    cta: "Pay in full · $3,000",
    featured: false,
  },
];

const DISTRIBUTION_NOTES: { title: string; body: string }[] = [
  {
    title: "Natural growth in your community",
    body:
      "Every page on your site gets tuned to the city, region, and niche you actually operate in — GEO-specific landing pages, schema-rich content, internal link graph. The audience already searching for what you do finds you first.",
  },
  {
    title: "Distribution across the network",
    body:
      "Your services get featured across federation surfaces — operator newsletters, cross-promo embeds, newsroom placements. Reach compounds the moment a new node ships, not when you pay for more ads.",
  },
  {
    title: "Newsletter is part of the build",
    body:
      "Not an afterthought you bolt on later. A verified Resend domain, suppression handling, and engagement tracking are wired into your dashboard from day one.",
  },
];

// Named-referrer whitelist — kept as a closed set so the page
// can't be hit with arbitrary `?ref=AnythingGoes` text and render
// it on a public-domain URL. Any value not in this list (or no
// param at all) falls back to "Love Thy Barber" — the canonical default.
//
// Add new referrers here as Sita onboards them. Each entry should
// be properly Title-cased; the resolver does a case-insensitive
// match below.
const NAMED_REFERRERS = ["Love Thy Barber", "Jules", "Kimberly"] as const;
type NamedReferrer = (typeof NAMED_REFERRERS)[number];

function resolveReferrer(raw?: string | string[]): NamedReferrer {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return "Love Thy Barber";
  const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  return (NAMED_REFERRERS as readonly string[]).includes(cap)
    ? (cap as NamedReferrer)
    : "Love Thy Barber";
}

type PageProps = {
  searchParams: { ref?: string | string[] };
};

// Branded OG image surfaces the aligned numbers ($60K · $3,000 ·
// 20× ROI) in the link-preview card when shared in iMessage /
// Twitter / LinkedIn. Same /api/og Edge-route pattern used on
// every other private referral surface; the title interpolates
// the referrer name so per-referrer share links preview correctly.
function buildOgImage(name: NamedReferrer): string {
  const title = `Referred by ${name} · Under the Hood`;
  return `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&topic=%2460K%2B%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;
}

export function generateMetadata({ searchParams }: PageProps): Metadata {
  const name = resolveReferrer(searchParams.ref);
  const ogImage = buildOgImage(name);
  // Canonical URL doesn't include the ?ref param — the referrer
  // is rendering metadata only, not a separately-indexed surface.
  // Robots is noindex anyway so the canonical mostly affects
  // unfurlers (which read alternates.canonical to decide which
  // version of the URL to dedupe against).
  return {
    title: `Under the Hood · Referred by ${name}`,
    description: `$60K+ in self-generating digital assets for $3,000 — $300 down + $300/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee. ${name} sent you — here's the full breakdown of what ships.`,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: `Under the Hood · Referred by ${name}`,
      description: `$60K+ in assets for $3,000. 20× ROI. 100% guarantee. What's actually under the hood of the federation referral ${name} sent you.`,
      url: PAGE_URL,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Under the Hood · Referred by ${name}`,
      description: `$60K+ in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money. — ${name}`,
      images: [ogImage],
    },
    robots: { index: false, follow: false },
  };
}

export default function LoveThyBarberReferralInfoPage({
  searchParams,
}: PageProps): ReactNode {
  const referrerName = resolveReferrer(searchParams.ref);
  return (
    <LoveThyBarberReferralInfoClient
      pageUrl={PAGE_URL}
      caseStudy={CASE_STUDY}
      marketRates={MARKET_RATES}
      marketTotal={MARKET_TOTAL}
      pricingOptions={PRICING_OPTIONS}
      distributionNotes={DISTRIBUTION_NOTES}
      referrerName={referrerName}
    />
  );
}
