// /alira/referral/full — long-form companion to /alira/referral.
// The shorter index page is a 7-second teaser; this page carries
// the entire referral breakdown (leverage callout, chip strip,
// open-market value table, PROOF card, distribution + community
// grid, pricing reveal modal, why-this-is-different grid, AES-256
// final CTA, footer).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralFullClient } from "./AliraReferralFullClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral/full`;

// Live Stripe payment links (created 2026-05-15 via Stripe MCP):
//   - $3,000 one-time: price_1TXNpJE1uHPZaaHp4i5kIWsc
//   - $333/mo recurring: price_1TXNpME1uHPZaaHpcCZbCf3l
// Linked off Product prod_UWQgOQqLHioU4d. Re-declared here so the
// /full route is independently deployable from the teaser.
const PAY_FULL_URL = "https://buy.stripe.com/6oU4gz2j89yU2V90lW9fW0g";
const PAY_DEPOSIT_URL = "https://buy.stripe.com/aFa8wP6zocL69jx7Oo9fW0h";

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

const MARKET_RATES: { service: string; value: string }[] = [
  {
    service: "Bespoke Next.js website",
    value: "$25K–50K · custom codebase, SEO, JSON-LD, edge-rendered OG",
  },
  {
    service: "AI CEO + inbound routing layer",
    value: "$25K–50K to build · $36K+/yr retainer equivalent",
  },
  {
    service: "Branded newsletter + automation",
    value: "$15K+/yr · Resend infra, drip sequences, engagement tracking",
  },
  {
    service: "Federation cross-promo + sponsorship",
    value: "$30K+/yr · consistent placements across 16 partner businesses",
  },
  {
    service: "GEO + community distribution",
    value: "$40K+/yr · ranked landing pages per city + niche you operate in",
  },
];
const MARKET_TOTAL = "$200,000+";

const PRICING_OPTIONS = [
  {
    id: "deposit",
    label: "Secures your spot",
    price: "$333",
    cadenceTop: "down · $333/mo over 9 months",
    cadenceBottom: "This wave: only 50 businesses · cancel anytime if we don't ship",
    valueLine:
      "After your $333 clears we send a payment confirmation email with a one-click button to schedule your strategy meeting with our team. Slot is locked the moment payment lands.",
    payUrl: PAY_DEPOSIT_URL,
    cta: "Secure your spot · $333",
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

export const metadata: Metadata = {
  title: "Referred by Alira · Full Breakdown · $3,000 or $333 Down",
  description:
    "Referred by Alira — full breakdown. A Tier-3 bespoke website + AI CEO layer + branded newsletter + federation cross-promotion + community-specific distribution for $3,000 in full, or as little as $333 down to secure your spot. $100K+ in digital assets you own when the build ships. We don't even want the money — we want to prove what we build.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Alira · Full Breakdown",
    description:
      "$100K+ in digital assets you own outright. $3,000 in full or $333 down to secure your spot. We don't even want the money — we want to prove what we build.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Referred%20by%20Alira&topic=Full%20Breakdown%20%C2%B7%20%243%2C000%20or%20%24333%20down`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Alira · Full Breakdown",
    description:
      "$100K+ in assets. $3,000 full or $333 down. We don't even want the money.",
    images: [`${SITE_URL}/api/og?title=Referred%20by%20Alira&topic=Full%20Breakdown%20%C2%B7%20%243%2C000%20or%20%24333%20down`],
  },
  robots: { index: false, follow: false },
};

export default function AliraReferralFullPage(): ReactNode {
  return (
    <AliraReferralFullClient
      pageUrl={PAGE_URL}
      caseStudy={CASE_STUDY}
      marketRates={MARKET_RATES}
      marketTotal={MARKET_TOTAL}
      pricingOptions={PRICING_OPTIONS}
      distributionNotes={DISTRIBUTION_NOTES}
    />
  );
}
