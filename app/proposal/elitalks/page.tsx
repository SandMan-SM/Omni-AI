// /proposal/elitalks — strategic partnership proposal between Omni AI
// and the Ellie Talks podcast (Ellie). 6-month partnership; pricing
// is intentionally NOT surfaced on this page per Ben's 2026-05-13
// feedback ("take out costs from this site and give me costs in a
// text paragraph here"). Ben handles the price negotiation with
// Natalie directly — this surface is the relationship-trust artifact,
// not a self-serve checkout.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EliTalksClient } from "./EliTalksClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/proposal/elitalks`;

// Distribution surfaces — every place Ellie Talks gets featured.
const DISTRIBUTION: { title: string; body: string }[] = [
  {
    title: "Federation newsroom network",
    body:
      "Three Utah-based newsrooms (Utah Main Street · Beehive Biz Pulse · The Wasatch Post) feature Ellie Talks episodes inline. Organic + GEO traffic compounds for the duration of the deal.",
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

// Tracking — what gets measured every month.
const TRACKING: string[] = [
  "Monthly performance dashboard inside omnileadsagi.com/dashboard scoped to Ellie Talks",
  "Inbound events tracked per surface — podcast clicks, landing-page conversions, newsletter opens, ad CTRs",
  "Federation referral attribution — which network sites are driving listens",
  "Paid-social cost-per-subscriber + cost-per-listen",
  "SEO + GEO ranking tracker for every published asset",
  "Monthly written report from $Mafi with what shipped, what worked, what to iterate",
];

// What the partnership stands for, from Ellie's perspective. Not a
// pitch — a frame: the podcast is the asset, Omni AI is the
// infrastructure that compounds it.
const ABOUT_PODCAST = {
  headline:
    "Ellie Talks is the asset. Omni AI is the infrastructure that compounds it.",
  body:
    "Ellie has built a podcast with the one thing money cannot buy quickly: trust with an audience that's already there. This partnership doesn't try to manufacture more of that — it builds the surrounding infrastructure (sites, automation, paid distribution, organic SEO/GEO, federation cross-promo) so every episode pays compounding dividends across every channel an audience could find it on.",
};

// Comparable build — Live Better — On The Drip. Closest analog to
// the Ellie Talks shape: a podcast brand with a live show + community
// that needed real channel infrastructure (not a stock player
// widget) plus federation attribution. Already shipping inside the
// Omni AI portfolio, so Ellie can verify the build at
// livebetterpodcast.com before locking the deal.
const COMPARABLE = {
  brand: "Live Better — On The Drip",
  domain: "livebetterpodcast.com",
  url: "https://livebetterpodcast.com",
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
  title: "Omni AI × Ellie Talks · 6-Month Partnership Proposal",
  description:
    "A 6-month strategic partnership between Omni AI and Ellie Talks. Bespoke digital infrastructure — three custom websites, AI CEO automation, organic SEO + GEO, branded newsletter, federation cross-promotion.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Omni AI × Ellie Talks · 6-Month Partnership",
    description:
      "Six months of bespoke digital infrastructure: three websites, AI CEO layer, organic + paid distribution, branded newsletter, federation cross-promotion.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Omni%20AI%20%C3%97%20Ellie%20Talks&topic=6-Month%20Partnership%20Proposal`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI × Ellie Talks · 6-Month Partnership",
    description:
      "Six months of bespoke digital infrastructure across three websites, organic + paid distribution, and federation amplification.",
  },
  robots: { index: false, follow: false },
};

export default function EliTalksProposalPage(): ReactNode {
  return (
    <EliTalksClient
      pageUrl={PAGE_URL}
      distribution={DISTRIBUTION}
      tracking={TRACKING}
      about={ABOUT_PODCAST}
      comparable={COMPARABLE}
    />
  );
}
