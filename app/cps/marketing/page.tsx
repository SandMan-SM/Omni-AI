// /cps/marketing — explainer page for Korine (CPS operator) showing
// how the federation infrastructure compounds value across the 16
// businesses already in the portfolio. Internal-facing: she'll land
// here from the dashboard so the tone is "here's why what looks
// unusual is actually working in your favor," not a sales pitch.
//
// The numbers in this page come straight from Supabase + the federation
// case-studies registry. Update them by editing this file if the
// underlying counts shift materially.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CpsMarketingClient } from "./CpsMarketingClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/cps/marketing`;

// Headline numbers — sourced from the federation state.
//
//   networkSize:   live cross-promotion surfaces in the Omni AI
//                  portfolio. The federation case-studies registry
//                  has 22 entries; 16 of them are billable / live
//                  sites currently distributing inbound traffic.
//   leadsTotal:    CPS leads in omni_leads_generated.
//   leadsB2B:      Leads with a company attached (B2B).
//   leadsB2C:      Leads without a company (individual prospects).
//   websiteValue:  Tier-3 bespoke Next.js build retail range from
//                  lib/case-studies.ts ($18k–$25k).
//   budgetSpent:   Marketing budget burned to acquire those 100 leads
//                  through the federation distribution stack — close
//                  to zero because the infrastructure does the work.
const STATE = {
  networkSize: "16",
  leadsTotal: 100,
  leadsB2B: 90,
  leadsB2C: 10,
  websiteValueLow: "$18,000",
  websiteValueHigh: "$25,000",
  budgetSpent: "≈ $0",
};

// The three KPI tiles in the hero strip.
const KPIS: { label: string; value: string; sub: string }[] = [
  {
    label: "Federation reach",
    value: `${STATE.networkSize} businesses`,
    sub: "Your services already get cross-promoted across every node.",
  },
  {
    label: "Marketing spend",
    value: STATE.budgetSpent,
    sub: "The infrastructure is doing the distribution. Your retainer is barely touched.",
  },
  {
    label: "Website asset value",
    value: `${STATE.websiteValueLow}–${STATE.websiteValueHigh}`,
    sub: "Bespoke Tier-3 Next.js build already in your name.",
  },
];

// "Where your leads come from right now" — explains the 90/10 split
// without sounding apologetic about it.
const LEAD_MIX = {
  total: STATE.leadsTotal,
  b2b: STATE.leadsB2B,
  b2c: STATE.leadsB2C,
};

// The compounding-loop explanation. Each card describes one phase of
// the loop — read top-to-bottom they tell a story: federation seeds
// → B2B leads → asset velocity → wider reach → individual leads
// follow.
const LOOP_PHASES: { phase: string; title: string; body: string }[] = [
  {
    phase: "Phase 1",
    title: "Seed the federation",
    body:
      "Every new business we onboard becomes another cross-promotion surface. Your services get featured wherever they fit — newsletters, embedded promos, sponsor placements, federation case studies. Reach grows the moment we ship a new node.",
  },
  {
    phase: "Phase 2",
    title: "B2B leads flow in first",
    body: `Because we're actively building federation assets, the early inbound looks B2B-heavy on purpose — currently ${STATE.leadsB2B} of your ${STATE.leadsTotal} leads have a company attached. Operators and adjacent practices reach out because they see the infrastructure and want a version of it for themselves.`,
  },
  {
    phase: "Phase 3",
    title: "Asset velocity compounds",
    body:
      "Every B2B conversation that turns into a build adds another distribution node to the federation. The time-to-ship for the next asset drops because we're reusing the same engine — and the network's organic + GEO reach grows the moment the new site goes live.",
  },
  {
    phase: "Phase 4",
    title: "Individual leads compound after",
    body:
      "Once the federation hits saturation in a niche, the search + social surfaces pull in individuals at scale. That's where the 10,000-people-at-a-time numbers live — not in chasing single clients one at a time, but in owning the surfaces those individuals walk past.",
  },
];

// What's in motion behind the scenes — concrete deliverables Korine
// can verify in the dashboard.
const IN_MOTION: string[] = [
  "Bespoke Next.js website with full SEO + JSON-LD schema, already shipping",
  "AI CEO layer routing inbound leads + scoring intake",
  "Retention sequences for stale leads — automatic re-engagement at days 7, 30, 90",
  "Newsletter system on a verified Resend domain, suppression list, engagement tracking",
  `Cross-promo placements across ${STATE.networkSize} federation surfaces`,
  "Inbound event tracking — every click, every conversion, in your dashboard",
  "Monthly performance dashboard scoped to CPS inside omnileadsagi.com/dashboard",
  "Calendar automation + scoring + slot routing",
];

// The traditional-agency contrast. Renders as a 2-col grid where the
// left column ("Other agencies") feels heavy and the right column
// ("This system") feels light. The contrast is the message.
const AGENCY_VS_FEDERATION: { theirs: string; ours: string }[] = [
  {
    theirs: "Chase one client at a time",
    ours: "Compound across every node simultaneously",
  },
  {
    theirs: "Marketing budget = ad spend you burn",
    ours: "Marketing budget = infrastructure that compounds for you",
  },
  {
    theirs: "Stop paying → traffic stops",
    ours: "Work compounds well past any single campaign window",
  },
  {
    theirs: "Retainer goes to managing tools",
    ours: "Retainer goes to building distribution surfaces",
  },
  {
    theirs: "Reports tell you what they did last month",
    ours: "Dashboard shows you every inbound event live",
  },
];

// Shared OG image generated by /api/og — same brand chrome as the
// rest of the federation case-study and proposal pages so the link
// previews stay cohesive when shared in iMessage / email / Slack.
const OG_IMAGE_URL = `${SITE_URL}/api/og?title=Inside%20the%20Build&topic=CPS%20%C3%97%20Omni%20AI%20%C2%B7%2016%20businesses%20already%20amplifying%20your%20services`;

export const metadata: Metadata = {
  title: "How Your Marketing Is Actually Working · CPS × Omni AI",
  description:
    "An inside look at how Psych & Custody Evaluations' marketing budget is moving across 16 federation businesses, what the AI CEO layer is doing in the background, and why the current B2B-heavy lead mix is a feature, not a bug.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How Your Marketing Is Actually Working · CPS × Omni AI",
    description:
      "Marketing budget barely touched. Services already promoted across 16 businesses. Website asset already worth $18K–$25K. This page explains why.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "Inside the Build · CPS × Omni AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How Your Marketing Is Actually Working · CPS × Omni AI",
    description:
      "Marketing budget barely touched. Services already promoted across 16 businesses. This page explains why.",
    images: [OG_IMAGE_URL],
  },
  robots: { index: false, follow: false },
};

export default function CpsMarketingPage(): ReactNode {
  return (
    <CpsMarketingClient
      pageUrl={PAGE_URL}
      kpis={KPIS}
      leadMix={LEAD_MIX}
      loopPhases={LOOP_PHASES}
      inMotion={IN_MOTION}
      agencyVsFederation={AGENCY_VS_FEDERATION}
      websiteValueLow={STATE.websiteValueLow}
      websiteValueHigh={STATE.websiteValueHigh}
      networkSize={STATE.networkSize}
    />
  );
}
