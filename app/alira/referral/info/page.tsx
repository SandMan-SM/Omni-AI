// /alira/referral/info — long-form companion to /alira/referral.
// Was /alira/referral/full pre-2026-05-24; URL renamed for naming
// parity with /renelaveau/referral/info. A permanent redirect in
// next.config.mjs catches old /full links and 301s them here so
// shared URLs don't break.
//
// The shorter /alira/referral page is the teaser; this page
// carries the full breakdown (leverage callout, chip strip,
// open-market value table, Alira's live-build proof card,
// distribution + community grid, pricing reveal modal with two
// cards, why-this-is-different grid, AES-256 final CTA, footer).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralInfoClient } from "./AliraReferralInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral/info`;

// Live Stripe payment links — both prices sit under Alira product
// prod_UWQgOQqLHioU4d so reporting groups cleanly:
//   - $3,000 one-time:   price_1TXNpJE1uHPZaaHp4i5kIWsc (unchanged)
//   - $300/mo recurring: price_1TaibQE1uHPZaaHpys0KfVfX (new
//                         2026-05-24, replaces the prior $333/mo
//                         link to match the Rene referral cadence
//                         and the aligned $300 numbers across both
//                         Alira surfaces)
const PAY_FULL_URL = "https://buy.stripe.com/6oU4gz2j89yU2V90lW9fW0g";
const PAY_DEPOSIT_URL = "https://buy.stripe.com/5kQ3cv7DscL667l3y89fW0m";

const CASE_STUDY = {
  brand: "Alira",
  domain: "alira.live",
  url: "https://alira.live",
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
  caseStudyUrl: `${SITE_URL}/federation/case-studies/alira`,
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
const MARKET_TOTAL = "$60,000";

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

// Branded OG image surfaces the aligned numbers ($60K · $3,000 ·
// 20× ROI) in the link-preview card when shared in iMessage /
// Twitter / LinkedIn. Same /api/og Edge-route pattern used on
// every other private referral surface.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Jana%20%C2%B7%20Under%20the%20Hood&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;

export const metadata: Metadata = {
  title: "Under the Hood · Referred by Jana",
  description:
    "$60,000 in self-generating digital assets for $3,000 — $300 down + $300/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee. The full breakdown of what ships in the federation referral build.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Under the Hood · Referred by Jana",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. What's actually under the hood of the federation referral build.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Under the Hood · Referred by Jana",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function AliraReferralInfoPage(): ReactNode {
  return (
    <AliraReferralInfoClient
      pageUrl={PAGE_URL}
      caseStudy={CASE_STUDY}
      marketRates={MARKET_RATES}
      marketTotal={MARKET_TOTAL}
      pricingOptions={PRICING_OPTIONS}
      distributionNotes={DISTRIBUTION_NOTES}
    />
  );
}
