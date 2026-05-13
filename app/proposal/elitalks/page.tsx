// /proposal/elitalks — strategic partnership proposal between Omni AI
// and the Eli Talks podcast (Eli G). 6-month, $4,500/month deal in
// exchange for north of $100K of bespoke digital infrastructure +
// federation amplification + paid-social distribution.
//
// Internal cost split ($500 London/Natalie, $1,000 each $Mafi/Ben, the
// remainder to Eli) is INTENTIONALLY not shown on the page — this is
// the surface Eli sees, not the operating ledger. That stays internal.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EliTalksClient } from "./EliTalksClient";
import { BOOKING_URL } from "@/lib/booking";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/proposal/elitalks`;

// Booking destination — shared scheduler from lib/booking.ts. The
// deal is structured as a 6-month commitment so the primary CTA is
// "Book the partnership call" rather than an instant checkout.
const BOOK_CALL_URL = BOOKING_URL;

// What an agency-of-record would invoice for the same deliverables
// across the 6-month window. The "$100K" headline is conservative —
// the real retail equivalent is well past $180K once you sum each
// surface. Verify any line against current market rates.
const RETAIL_LINES: { item: string; spec: string; rate: string }[] = [
  {
    item: "Three bespoke websites",
    spec: "Three custom Next.js builds — full codebase ownership, JSON-LD schema, edge-rendered OG, federation embed wired in.",
    rate: "$30,000 × 3 · $90,000",
  },
  {
    item: "AI CEO layer + automation",
    spec: "Autonomous executive agent per site — lead routing, follow-up sequences, calendar booking, escalation paths.",
    rate: "$8,000 × 3 · $24,000",
  },
  {
    item: "Meta + YouTube + Instagram paid program",
    spec: "30 short-form ads + 12 long-form videos + pixel infrastructure + retargeting audiences + iteration cycle.",
    rate: "$25,000",
  },
  {
    item: "SEO + GEO content engine",
    spec: "Organic discovery for every show topic — Geographic + topical landing pages, schema-rich articles, internal link graph.",
    rate: "$18,000",
  },
  {
    item: "Newsletter system + distribution",
    spec: "Branded Resend infrastructure, suppression list, engagement tracking, mirrored into the agentic dashboard.",
    rate: "$10,000",
  },
  {
    item: "Calendar + inbound automation",
    spec: "Cal.com integration, intake form scoring, slot routing, no-show recovery.",
    rate: "$5,000",
  },
  {
    item: "Federation cross-promotion",
    spec: "Featured across all federation-owned newsletters + sites + the Omni AI portfolio for the duration of the deal.",
    rate: "$10,000",
  },
];
const RETAIL_TOTAL = "$182,000";

// The deal at a glance.
const DEAL_TERMS = {
  monthly: "$4,500",
  duration: "6 months",
  totalCommitment: "$27,000",
  retailValue: "$100,000+",
  leverage: "4×",
};

// Distribution surfaces — every place Eli Talks gets featured.
const DISTRIBUTION: { title: string; body: string }[] = [
  {
    title: "Federation newsroom network",
    body:
      "Three Utah-based newsrooms (Utah Main Street · Beehive Biz Pulse · The Wasatch Post) feature Eli Talks episodes inline. Organic + GEO traffic compounds for the duration of the deal.",
  },
  {
    title: "Federation cross-promo embed",
    body:
      "Every site in the Omni AI portfolio carries the federation cross-promo widget. Eli Talks gets weighted impression share across the network.",
  },
  {
    title: "Owner-network newsletter inclusion",
    body:
      "Each operator newsletter (CPS, Leifson, Youngs, LTB, Prime IV, etc.) features Eli Talks in dedicated placements. Real audience exposure — not generic ad inventory.",
  },
  {
    title: "Paid social engine",
    body:
      "Meta + Instagram + YouTube paid distribution scoped to Eli Talks ICP. Optimized weekly against cost-per-subscriber, not vanity engagement.",
  },
];

// Tracking — what gets measured every month.
const TRACKING: string[] = [
  "Monthly performance dashboard inside omnileadsagi.com/dashboard scoped to Eli Talks",
  "Inbound events tracked per surface — podcast clicks, landing-page conversions, newsletter opens, ad CTRs",
  "Federation referral attribution — which network sites are driving listens",
  "Paid-social cost-per-subscriber + cost-per-listen",
  "SEO + GEO ranking tracker for every published asset",
  "Monthly written report from $Mafi with what shipped, what worked, what to iterate",
];

// What the partnership stands for, from Eli's perspective. Not a
// pitch — a frame: the podcast is the asset, Omni AI is the
// infrastructure that compounds it.
const ABOUT_PODCAST = {
  headline:
    "Eli Talks is the asset. Omni AI is the infrastructure that compounds it.",
  body:
    "Eli G has built a podcast with the one thing money cannot buy quickly: trust with an audience that's already there. This partnership doesn't try to manufacture more of that — it builds the surrounding infrastructure (sites, automation, paid distribution, organic SEO/GEO, federation cross-promo) so every episode pays compounding dividends across every channel an audience could find it on.",
};

// Comparable build — Live Better — On The Drip. Closest analog to
// the Eli Talks shape: a podcast brand with a live show + community
// that needed real channel infrastructure (not a stock player
// widget) plus federation attribution. Already shipping inside the
// Omni AI portfolio, so Eli can verify the build at
// livebetterpodcast.com before locking the deal.
const COMPARABLE = {
  brand: "Live Better — On The Drip",
  domain: "livebetterpodcast.com",
  url: "https://livebetterpodcast.com",
  role: "Channel partner · podcast + community",
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
  title: "Omni AI × Eli Talks · 6-Month Partnership Proposal",
  description:
    "A 6-month strategic partnership between Omni AI and Eli Talks. $4,500/month delivers $100,000+ of bespoke digital infrastructure: three custom websites, AI CEO automation, paid-social engine, SEO + GEO content, newsletter system, federation distribution.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Omni AI × Eli Talks · 6-Month Partnership",
    description:
      "$4,500/month for 6 months. $100K+ in bespoke digital infrastructure. Three websites, paid-social engine, federation cross-promotion.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Omni%20AI%20%C3%97%20Eli%20Talks&topic=6-Month%20Partnership%20Proposal`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI × Eli Talks · 6-Month Partnership",
    description:
      "$27,000 over 6 months. $100K+ of built infrastructure. The full distribution stack.",
  },
  robots: { index: false, follow: false },
};

export default function EliTalksProposalPage(): ReactNode {
  return (
    <EliTalksClient
      bookCallUrl={BOOK_CALL_URL}
      pageUrl={PAGE_URL}
      retailLines={RETAIL_LINES}
      retailTotal={RETAIL_TOTAL}
      dealTerms={DEAL_TERMS}
      distribution={DISTRIBUTION}
      tracking={TRACKING}
      about={ABOUT_PODCAST}
      comparable={COMPARABLE}
    />
  );
}
