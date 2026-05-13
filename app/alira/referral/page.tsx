// /alira/referral — referral landing for anyone Alira sends to lock
// in a Tier-3 bespoke build at the federation-discount price. The
// page positions Alira as the proof artifact (live federation case
// study), then surfaces two payment options via a reveal-on-click
// "Lock in your seat" CTA: $2,500 annual OR $1,500 over 4 months.
//
// Both prices buy the same deliverable — a $20,000 retail-equivalent
// website + newsletter + sponsorship inclusion + distribution across
// the federation assets, tuned to the recipient's community / city.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "./AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral`;

// Stripe payment-link placeholders. Sita: swap these constants with
// the real live-mode payment links when ready. Until then the buttons
// open the placeholder URLs.
const PAY_ANNUAL_URL = "https://buy.stripe.com/REPLACE_WITH_ANNUAL_2500";
const PAY_4MONTH_URL = "https://buy.stripe.com/REPLACE_WITH_4MO_1500";

// The case study Alira is referring people on the basis of.
const CASE_STUDY = {
  brand: "Alira",
  domain: "alira.com",
  url: "https://alira.com",
  role: "Personal Brand · AI CEO",
  // Pulled from lib/case-studies.ts to keep the numbers honest.
  tagline:
    "Bespoke Next.js channel hub with the AI CEO layer routing inbound, a federated cross-promo embed, and newsletter distribution wired into the broader Omni AI portfolio.",
  shippedBullets: [
    "Custom Next.js codebase + design system",
    "AI CEO layer for inbound routing + scoring",
    "Federation cross-promo embed driving organic referral traffic",
    "Newsletter system on a verified Resend domain",
    "JSON-LD + edge-rendered OG for full search-surface coverage",
  ],
  caseStudyUrl: `${SITE_URL}/federation/case-studies/alira`,
};

// What the recipient gets if they lock in. Numbers framed as retail-
// equivalent so the leverage math reads ($20K of work for $1,500 or
// $2,500).
const RETAIL_LINES: { item: string; spec: string; rate: string }[] = [
  {
    item: "Bespoke Next.js website",
    spec: "Custom codebase, full SEO + JSON-LD schema, edge-rendered OG, sitemap + robots, custom 404/loading.",
    rate: "$14,000",
  },
  {
    item: "Newsletter system",
    spec: "Branded Resend domain, suppression list, engagement mirroring into your dashboard.",
    rate: "$3,000",
  },
  {
    item: "Sponsorship inclusion",
    spec: "Featured across federation surfaces — operator newsletters, cross-promo embed, newsroom placements.",
    rate: "$2,000",
  },
  {
    item: "Distribution across assets",
    spec: "GEO + community-specific landing pages, ranked for the city + niche you actually operate in.",
    rate: "$1,000",
  },
];
const RETAIL_TOTAL = "$20,000";

// Two pricing options revealed when the user clicks "Lock in your seat".
const PRICING_OPTIONS = [
  {
    id: "annual",
    label: "Annual",
    price: "$2,500",
    cadence: "billed once · 12 months covered",
    valueLine: "Lowest total · best leverage on a $20K build",
    payUrl: PAY_ANNUAL_URL,
    cta: "Lock in · $2,500 / year",
    featured: true,
  },
  {
    id: "4month",
    label: "4-month split",
    price: "$1,500",
    cadence: "billed once · 4-month window",
    valueLine: "Lower upfront commitment to start ranking + shipping",
    payUrl: PAY_4MONTH_URL,
    cta: "Lock in · $1,500 / 4-month",
    featured: false,
  },
];

// Distribution + community frame — the part that makes this build
// worth more than a plain website.
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
  title: "Locked in by Alira · $20K Build for $1,500 or $2,500",
  description:
    "Alira's referral — lock in a Tier-3 bespoke website + newsletter + federation sponsorship + community-specific distribution for $1,500 (4-month) or $2,500 (annual). Same retail-$20,000 build that runs Alira's own brand.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Locked in by Alira · $20K Build for $1,500 or $2,500",
    description:
      "$20,000 of bespoke infrastructure — site, newsletter, sponsorship, distribution — at the federation-discount price.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=%2420K%20build%20%C2%B7%20federation%20pricing`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Locked in by Alira · $20K Build for $1,500 or $2,500",
    description:
      "$20K build at federation-discount pricing. Site + newsletter + sponsorship + distribution.",
    images: [`${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=%2420K%20build%20%C2%B7%20federation%20pricing`],
  },
  // Private referral surface — only people Alira sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralPage(): ReactNode {
  return (
    <AliraReferralClient
      pageUrl={PAGE_URL}
      caseStudy={CASE_STUDY}
      retailLines={RETAIL_LINES}
      retailTotal={RETAIL_TOTAL}
      pricingOptions={PRICING_OPTIONS}
      distributionNotes={DISTRIBUTION_NOTES}
    />
  );
}
