// /proposal/elitalks/full — long-form companion to /proposal/elitalks.
// The shorter index page is a 7-second teaser; this page carries the
// full breakdown (hero leverage callout, trophy-card open-market
// panel, scope strip, about the podcast, what gets built, eight
// surfaces, paid platforms, federation distribution, comparable case
// study, tracking, NEW Omni AI Exclusive Membership tier, pass-it-
// forward share row).
//
// Same data sources as /proposal/elitalks — distribution, tracking,
// about, comparable. Re-declared here so the two pages stay
// independently deployable; a future refactor can extract them into
// a shared lib/elitalks-proposal.ts if both need to read from a
// single source of truth.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EliTalksFullClient } from "./EliTalksFullClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/proposal/elitalks/full`;

const DISTRIBUTION: { title: string; body: string }[] = [
  {
    title: "Federation newsroom network",
    body:
      "Three news outlets feature Ellie Talks episodes inline. Organic + GEO traffic compounds for the duration of the deal.",
  },
  {
    title: "Federation cross-promo embed",
    body:
      "Every site in the Omni AI portfolio carries the federation cross-promo widget. Ellie Talks gets weighted impression share across the network.",
  },
  {
    title: "Owner-network newsletter inclusion",
    body:
      "Each operator newsletter (CPS, Leifson, Youngs, LTB, Prime IV, etc.) features Ellie Talks in dedicated placements. Real audience exposure — not generic ad inventory.",
  },
  {
    title: "Paid social engine",
    body:
      "Meta + Instagram + YouTube paid distribution scoped to Ellie Talks ICP. Optimized weekly against cost-per-subscriber, not vanity engagement.",
  },
];

const TRACKING: string[] = [
  "Monthly performance dashboard inside omnileadsagi.com/dashboard scoped to Ellie Talks",
  "Inbound events tracked per surface — podcast clicks, landing-page conversions, newsletter opens, ad CTRs",
  "Federation referral attribution — which network sites are driving listens",
  "Paid-social cost-per-subscriber + cost-per-listen",
  "SEO + GEO ranking tracker for every published asset",
  "Monthly written report from $Mafi with what shipped, what worked, what to iterate",
];

const ABOUT_PODCAST = {
  headline:
    "Ellie Talks is the asset. Omni AI is the infrastructure that compounds it.",
  body:
    "Ellie has built a podcast with the one thing money cannot buy quickly: trust with an audience that's already there. This partnership doesn't try to manufacture more of that — it builds the surrounding infrastructure (sites, automation, paid distribution, organic SEO/GEO, federation cross-promo) so every episode pays compounding dividends across every channel an audience could find it on.",
};

const COMPARABLE = {
  brand: "Live Better — On The Drip",
  domain: "livebetteronthedrip.com",
  url: "https://livebetteronthedrip.com",
  role: "Case study · podcast + community",
  caseStudyUrl: "/federation/case-studies/live-better-on-the-drip",
  tagline:
    "Custom Next.js channel hub for the show + community + federation attribution — one codebase, one brand surface.",
  shipped:
    "Bespoke channel hub with custom design system, full SEO + JSON-LD surface, episode + community pages, federation tracker firing on every page-view, cross-promo embed in rotation, and attribution tied through to operator-brand conversions + brokered sponsor revenue splits.",
  shippedBullets: [
    "Custom Next.js codebase, full ownership",
    "Episode + community pages with SEO + JSON-LD",
    "Federation tracker — inbound_otd_events live since launch",
    "Cross-brand referral attribution to operator conversions",
    "Brokered sponsor revenue splits wired in",
  ],
};

export const metadata: Metadata = {
  title: "Omni AI × Ellie Talks · Full Partnership Breakdown",
  description:
    "Full deliverable breakdown for the 6-month Omni AI × Ellie Talks partnership — paid-social engine, three websites, AI CEO layer, federation distribution, comparable case study, tracking dashboard, and the Omni AI Exclusive Membership tier ($1,000/mo) that keeps Ellie inside the network after the build window closes.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Omni AI × Ellie Talks · Full Partnership Breakdown",
    description:
      "The deep dive: every deliverable across the 6-month build window plus the $1,000/mo Omni AI Exclusive Membership that compounds the partnership.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Omni%20AI%20%C3%97%20Ellie%20Talks&topic=Full%20Partnership%20Breakdown`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI × Ellie Talks · Full Partnership Breakdown",
    description:
      "Every deliverable across the 6-month partnership + the $1,000/mo Omni AI Exclusive Membership tier.",
  },
  robots: { index: false, follow: false },
};

export default function EliTalksFullPage(): ReactNode {
  return (
    <EliTalksFullClient
      pageUrl={PAGE_URL}
      distribution={DISTRIBUTION}
      tracking={TRACKING}
      about={ABOUT_PODCAST}
      comparable={COMPARABLE}
    />
  );
}
