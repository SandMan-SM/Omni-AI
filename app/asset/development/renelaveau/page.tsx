// /asset/development/renelaveau — partnership-resource page Rene shares
// with people inside The Society of the Silver Line who want their own
// AI-CEO website. Framed as Rene's recommendation, not as a paid
// affiliate placement (per Sita's brief: "i don't really want it to
// say that he's getting paid for this"). Stripe Payment Links wired
// to a $1,500 one-time price; the second button surfaces Klarna's
// pay-in-3 as $500/mo × 3. Booking CTA at the bottom + share row so
// it propagates inside Rene's audience.
//
// The whole page is a single client component because the share row
// uses navigator.share / window.open and the Stripe buttons fire a
// 'pay_intent' inbound event to omnileadsagi.com so we can see which
// surface drove the click.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AssetClient } from "./AssetClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/asset/development/renelaveau`;

// Stripe Payment Links (live mode) — both back the same $1,500
// one-time price (prod_UUdhXWpcV8jWPR / price_1TVeQTE1uHPZaaHpKXA1CAt3).
// The Klarna link is a separate link so we can attribute clicks
// independently in Stripe's dashboard and so a buyer who picks the
// installment plan lands on a checkout that's already framed as such.
const PAY_FULL_URL = "https://buy.stripe.com/28EcN51f43aw1R52u49fW0b";
const PAY_KLARNA_URL = "https://buy.stripe.com/28E9AT5vkfXibrFfgQ9fW0c";

export const metadata: Metadata = {
  title: "Build Your Own AI-CEO Site · Recommended by Rene Laveau",
  description:
    "Rene Laveau's recommended partner for building your own AI-CEO website inside The Society of the Silver Line. Bespoke Next.js codebase, federation distribution, 12-month operational retainer. $1,500 one-time or 3 × $500 via Klarna.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Build Your Own AI-CEO Site · Recommended by Rene Laveau",
    description:
      "Bespoke Next.js + AI CEO layer + federation distribution. $1,500 one-time or 3 × $500 via Klarna.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: `${SITE_URL}/api/og?title=Build%20Your%20Own%20AI-CEO%20Site&topic=Recommended%20by%20Rene%20Laveau`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Your Own AI-CEO Site · Recommended by Rene Laveau",
    description:
      "Bespoke Next.js + AI CEO layer + federation distribution. $1,500 one-time or 3 × $500 via Klarna.",
  },
  robots: { index: true, follow: true },
};

// Three-card "what you get" middle section data.
const DELIVERABLES: { title: string; body: string }[] = [
  {
    title: "Bespoke Next.js Build",
    body: "Custom codebase, custom design system, JSON-LD schema, edge-rendered OG images, sitemap + robots, custom 404 + loading states. Not a template.",
  },
  {
    title: "AI CEO Layer",
    body: "An autonomous executive agent owns a business function for you — leads, content, ops, outbound. Memory, judgment, tool-use, and a P&L it's accountable to. Not a chatbot.",
  },
  {
    title: "Federation Distribution",
    body: "Your site joins the network: cross-promo embed, sponsor weight tuning, inbound attribution, and a workspace inside the agentic dashboard. You don't just ship a site — you ship a node.",
  },
];

// What's in scope — written so the prospect feels what they get,
// not what we charge for. Order matters: starts with the visible
// build, ends with the long-run operational retainer.
const SCOPE: string[] = [
  "Full custom Next.js codebase you own outright",
  "Brand identity capture + custom palette, typography, animation",
  "JSON-LD structured data on every page (Schema.org compliant)",
  "Analytics pipeline → your own dashboard inside omnileadsagi.com",
  "Federation cross-promo embed wired to your slug",
  "OG + Twitter card images on every shareable URL",
  "12-month operational retainer — content support, infra patches, monthly reviews",
  "Direct line to Rene during onboarding",
];

export default function AssetRenePartnership(): ReactNode {
  return (
    <AssetClient
      payFullUrl={PAY_FULL_URL}
      payKlarnaUrl={PAY_KLARNA_URL}
      pageUrl={PAGE_URL}
      deliverables={DELIVERABLES}
      scope={SCOPE}
    />
  );
}
