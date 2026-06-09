// /meta/proposal/full — long-form companion to /meta/proposal.
// The shorter index page is a 7-second teaser; this page carries
// the entire 90-day Meta Growth Program breakdown (leverage
// callout, scope-at-a-glance strip, what-ships chip strip, trophy-
// card open-market panel, two channel cards (Facebook + Instagram),
// why-niche reasoning, comparable case study, "why this isn't a
// normal Meta agency deal" 3-card grid, AES-256 trust strip, final
// CTA pair).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MetaProposalFullClient } from "./MetaProposalFullClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/meta/proposal/full`;

// PayPal public Client ID (publishable — safe in the browser/repo, like a
// Stripe publishable key). Baked in so the live deploy works without a
// Vercel env var. Pairs with plan P-0CW08001LU923782MNIUHR6I.
const PAYPAL_CLIENT_ID = "AW72P6A-yKEg77Tkh866rDoce2DKYU2EUhGKQp-401eIFKpSERKCOETvqtcSYTVTN4rnFbvBt6vP6Lf4";

// Stripe payment link — Meta Growth Program · 90-Day Paid-Social Creative
// Product:  prod_UctZ2gTDbou1lE
// Price:    price_1Tddm3E1uHPZaaHpXPIspjhN  ($1,500/mo recurring)
// Plink:    plink_1Tddn8E1uHPZaaHpkGa042R8
const PAY_FULL_URL = "https://buy.stripe.com/00w28rf5U26s9jxgkU9fW0p";

// Retail-equivalent line items — what an agency-of-record would
// invoice for the same deliverables. Re-declared here so the full
// page is independently deployable; both routes' rate cards agree
// by hand.
const RETAIL_LINES: { item: string; spec: string; rate: string }[] = [
  {
    item: "30 short-form vertical ads",
    spec: "Reels + Stories — scripted, edited, captioned",
    rate: "$2,000/asset · $60,000",
  },
  {
    item: "Ad-account infrastructure",
    spec: "Meta Business Manager, pixel, CAPI, conversion events, retargeting audiences",
    rate: "$5,000",
  },
  {
    item: "Audience research + funnel",
    spec: "ICP map, intent keywords, landing-page funnel, lead form copy",
    rate: "$8,000",
  },
  {
    item: "Creative testing + iteration",
    spec: "Weekly winners-and-losers reviews, hook A/B tests, format pivots, retargeting-pool rebuilds",
    rate: "$2,000/wk · $24,000",
  },
];
const RETAIL_TOTAL = "$100K+";

const CHANNELS: { tag: string; title: string; body: string }[] = [
  {
    tag: "Meta",
    title: "Facebook lead-form engine",
    body:
      "Lead-form ads, lookalike audiences off your CRM, behavioral retargeting to family members of people searching for help. Real testimonials, not stock photos. Optimized weekly against actual cost-per-admit, not vanity engagement.",
  },
  {
    tag: "Instagram",
    title: "Reels + Stories",
    body:
      "30 vertical assets repurposed across feed, Reels, and Stories. DM-automation funnels for inbound questions. Tied to the same Meta pixel so every view fuels the retargeting pool the lead ads run against.",
  },
];

const WHY_NICHE: string[] = [
  "The decision-maker is rarely the patient — it's the family. Search alone misses them; Meta's behavioral audiences find them where they already are.",
  "The buying cycle is 3–6 weeks of quiet research. The Meta retargeting pool is what keeps your name in front of the family across every scroll of that window — every new ad is a permanent fixture in their feed.",
  "Trust is the gate. Real faces, real outcomes, real licensing badges convert orders of magnitude better than stock-image lead ads.",
  "Cost-per-admit beats cost-per-click. We optimize against the metric that pays your bills, not the metric Meta defaults to.",
  "Compliant creative wins. We script around HIPAA + ad-platform policy from the first frame, so accounts don't get suspended mid-campaign.",
];

const CASE_STUDY = {
  niche: "Court-ordered psych evaluation practice · Utah",
  shipped:
    "Custom Next.js site, AI CEO layer for inbound routing, federation distribution, 100 inbound leads generated in the first 30 days, integrated with their existing referral pipeline.",
  reflectMetric: "100 inbound leads · 30 days · single tenant",
};

export const metadata: Metadata = {
  title: "Meta Growth Program · Full Breakdown · 90 Days for $1,500/mo",
  description:
    "Full deliverable breakdown for the 90-day Meta Growth Program — Facebook + Instagram paid-social engine for behavioral-health and recovery centers. 30 short-form ads, full Meta + pixel + CAPI infrastructure, audience research + funnel, weekly creative testing — all on a $1,500/month subscription you can cancel anytime after month one.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Meta Growth Program · Full Breakdown",
    description:
      "The deep dive: every deliverable across the 90-day Meta partnership, two channels, comparable case study, and the chrome-flash CTA pair to start.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Meta%20Growth%20Program&topic=Full%20Breakdown%20%C2%B7%2090%20Days`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta Growth Program · Full Breakdown",
    description:
      "Every deliverable across the 90-day Meta partnership. $1,500/month, cancel anytime after month one.",
  },
  robots: { index: false, follow: false },
};

export default function MetaProposalFullPage(): ReactNode {
  return (
    <MetaProposalFullClient
      payFullUrl={PAY_FULL_URL}
      paypalClientId={PAYPAL_CLIENT_ID}
      paypalPlanId="P-0CW08001LU923782MNIUHR6I"
      pageUrl={PAGE_URL}
      retailLines={RETAIL_LINES}
      retailTotal={RETAIL_TOTAL}
      channels={CHANNELS}
      whyNiche={WHY_NICHE}
      caseStudy={CASE_STUDY}
    />
  );
}
