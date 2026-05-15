// /alira/referral — referral landing for anyone Alira sends to lock
// in a Tier-3 bespoke build at the federation-discount price. Mirrors
// the /proposal/elitalks visual structure (cosmic backdrop, serif
// headline, amber-chip strip, "What it's worth on the open market"
// panel) and ends in an "Activate your assets" CTA that reveals two
// payment options:
//
//   1. Pay in full        — $3,000 one-time Stripe checkout
//   2. Hold your spot     — $333/mo recurring (≈ 9-month payment plan)
//
// Both buy the same Tier-3 build that runs Alira's own brand.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "./AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral`;

// Live Stripe payment links (created 2026-05-15 via Stripe MCP):
//   - $3,000 one-time: price_1TXNpJE1uHPZaaHp4i5kIWsc
//   - $333/mo recurring: price_1TXNpME1uHPZaaHpcCZbCf3l
// Linked off Product prod_UWQgOQqLHioU4d. The recurring price runs
// open-ended; Sita closes the subscription manually at month 9 (or
// after final payment lands). To convert to a Subscription Schedule
// with `iterations: 9` later, swap the payment link for a custom
// /api/stripe/subscribe endpoint that creates the schedule server-
// side — out of scope for the referral surface itself.
const PAY_FULL_URL = "https://buy.stripe.com/6oU4gz2j89yU2V90lW9fW0g";
const PAY_DEPOSIT_URL = "https://buy.stripe.com/aFa8wP6zocL69jx7Oo9fW0h";

// The case study Alira is referring people on the basis of — i.e.
// Alira's own live build. Pulled from lib/case-studies.ts so the
// numbers + bullets stay honest against the federation source of
// truth.
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

// Open-market value table — what a mid-market agency would invoice
// for the same deliverables. Anchors the referral price against
// real numbers without us ever disclosing margin. Mirrors the
// "What this is worth on the open market" panel on the Ellie Talks
// proposal.
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
// Headline anchor — 12-month-equivalent agency rates sum honestly to
// ~$200K+ for the full Tier-3 stack + run-state retainers + federation
// exposure. Not aspirational — what a mid-market agency would actually
// invoice across the first year.
const MARKET_TOTAL = "$200,000+";

// Two pricing options revealed by the hero "Activate your assets"
// CTA. Same Tier-3 build either way — only the cadence differs.
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

// What it really buys you — the surrounding system, not just a
// website. Tier-3 build is the launch surface; the federation
// layer is what compounds it.
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
  title: "Locked in by Alira · $200K+ Build for $3,000 or $333 Down",
  description:
    "Alira's referral — lock in a Tier-3 bespoke website + AI CEO layer + branded newsletter + federation cross-promotion + community-specific distribution for $3,000 in full, or as little as $333 down to secure your spot. Same retail-$200K+ build that runs Alira's own brand.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Locked in by Alira · $200K+ Build for $3,000 or $333 Down",
    description:
      "Bespoke site + AI CEO + newsletter + federation distribution. Pay $3,000 in full or $333 down to secure your spot. Same Tier-3 stack Alira runs on. 50 businesses this wave.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=%243%2C000%20build%20%C2%B7%20%24333%20down%20to%20hold%20your%20spot`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Locked in by Alira · $200K+ Build for $3,000 or $333 Down",
    description:
      "Bespoke site + AI CEO + newsletter + federation distribution. $3,000 full or $333 down to secure your spot.",
    images: [`${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=%243%2C000%20build%20%C2%B7%20%24333%20down%20to%20hold%20your%20spot`],
  },
  // Private referral surface — only people Alira sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralPage(): ReactNode {
  return (
    <AliraReferralClient
      pageUrl={PAGE_URL}
      caseStudy={CASE_STUDY}
      marketRates={MARKET_RATES}
      marketTotal={MARKET_TOTAL}
      pricingOptions={PRICING_OPTIONS}
      distributionNotes={DISTRIBUTION_NOTES}
    />
  );
}
