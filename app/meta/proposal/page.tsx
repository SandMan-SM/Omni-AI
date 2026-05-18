// /meta/proposal — single-page sales asset for a behavioral-health /
// recovery prospect. Generic on purpose (the prospect's brand name
// never appears in copy or metadata). Pitches a 60-day Meta + YouTube
// creative engine that retail-equivalent prices at $100K+ for
// $1,500/month subscription. Visual rhythm mirrors the elitalks
// proposal (leverage callout, scope-at-a-glance tiles, chip strip,
// trophy-card open-market panel, AES-256 trust strip on final CTA).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProposalClient } from "./ProposalClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/meta/proposal`;

// Stripe payment link — TEMPORARY one-time price kept here until
// Sita creates the $1,500/month recurring price in the Stripe
// Dashboard and drops the new payment-link URL here. Steps Sita
// takes (Stripe MCP is disconnected):
//   1. Products → existing product → Add price → recurring, $1,500
//      per month → Save
//   2. Payment Links → Create payment link → pick the new price →
//      Copy URL
//   3. Paste the new URL into PAY_FULL_URL below and ship.
// Until then the button still works but bills one-time.
const PAY_FULL_URL = "https://buy.stripe.com/28EcN51f43aw1R52u49fW0b";

export const metadata: Metadata = {
  title: "Meta + YouTube Growth Proposal · $100K of Creative for $1,500/mo",
  description:
    "A 60-day Meta + YouTube + Instagram creative engine for behavioral-health and recovery centers. 30 short-form ads, 12 long-form videos, full tracking + retargeting infrastructure. Agency retail value $100K+. Operator price $1,500/month, cancel anytime after month one.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Meta + YouTube Growth Proposal",
    description:
      "30 short-form ads + 12 long-form videos + Meta/YouTube/Instagram infrastructure. $100K of creative for $1,500/month.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Meta%20%2B%20YouTube%20Growth%20Proposal&topic=%24100K%20of%20creative%20for%20%241%2C500%2Fmo`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta + YouTube Growth Proposal",
    description:
      "$100K of paid-social creative for $1,500/month. 60-day engine, three channels.",
  },
  // Discreet pitch — keep it crawlable so Sita can share the link
  // freely but ranking isn't the point.
  robots: { index: true, follow: true },
};

// Retail-equivalent line items — what an agency-of-record would
// invoice for the same deliverables. Sums to $103,000 so the "$100K"
// headline isn't marketing fluff; it's defensible from production
// rates that any prospect can verify.
const RETAIL_LINES: { item: string; spec: string; rate: string }[] = [
  {
    item: "30 short-form vertical ads",
    spec: "Reels / Shorts / Stories — scripted, edited, captioned",
    rate: "$2,000/asset · $60,000",
  },
  {
    item: "12 long-form YouTube videos",
    spec: "Branded interviews + explainers, fully produced",
    rate: "$2,500/video · $30,000",
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
];
const RETAIL_TOTAL = "$103,000";

// Three channels — what each one is built to do for the niche.
const CHANNELS: { tag: string; title: string; body: string }[] = [
  {
    tag: "Meta",
    title: "Facebook + Instagram",
    body:
      "Lead-form ads, lookalike audiences off your CRM, behavioral retargeting to family members of people searching for help. Real testimonials, not stock photos. Optimized weekly against actual cost-per-admit, not vanity engagement.",
  },
  {
    tag: "YouTube",
    title: "Long-form authority",
    body:
      "A branded channel where 12 produced videos answer the questions families type into Google at 2am. YouTube is where high-trust niches close the 6-week consideration window. We script, film direction, edit, thumbnail, SEO.",
  },
  {
    tag: "Instagram",
    title: "Reels + Stories",
    body:
      "30 vertical assets repurposed across feed, Reels, and Stories. DM-automation funnels for inbound questions. Tied to the same Meta pixel so every view fuels the retargeting pool the lead ads run against.",
  },
];

// Why this play works specifically in behavioral-health / recovery —
// without naming the prospect or using stigmatizing language. Frames
// the niche by the structural facts (decision-makers, search window,
// trust gate) rather than the affliction.
const WHY_NICHE: string[] = [
  "The decision-maker is rarely the patient — it's the family. Search alone misses them; Meta's behavioral audiences find them where they already are.",
  "The buying cycle is 3–6 weeks of quiet research. YouTube is where that research happens. Owning that surface compounds — every new video is a permanent asset.",
  "Trust is the gate. Real faces, real outcomes, real licensing badges convert orders of magnitude better than stock-image lead ads.",
  "Cost-per-admit beats cost-per-click. We optimize against the metric that pays your bills, not the metric Meta defaults to.",
  "Compliant creative wins. We script around HIPAA + ad-platform policy from the first frame, so accounts don't get suspended mid-campaign.",
];

// Anonymized comparable. The prospect needs to see that this engine
// has shipped before in a similarly high-trust regional niche. CPS
// (Psych & Custody Evaluations) is the closest live build — same
// "regulated, referral-driven, family-decision" shape. Numbers come
// straight from omni_leads_generated as of the verification SQL run.
const CASE_STUDY = {
  niche: "Court-ordered psych evaluation practice · Utah",
  shipped:
    "Custom Next.js site, AI CEO layer for inbound routing, federation distribution, 100 inbound leads generated in the first 30 days, integrated with their existing referral pipeline.",
  reflectMetric: "100 inbound leads · 30 days · single tenant",
};

export default function MetaProposalPage(): ReactNode {
  return (
    <ProposalClient
      payFullUrl={PAY_FULL_URL}
      pageUrl={PAGE_URL}
      retailLines={RETAIL_LINES}
      retailTotal={RETAIL_TOTAL}
      channels={CHANNELS}
      whyNiche={WHY_NICHE}
      caseStudy={CASE_STUDY}
    />
  );
}
