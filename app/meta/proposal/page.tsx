// /meta/proposal — 7-second teaser surface for the Meta + YouTube
// growth program proposal. Generic on purpose (the prospect's brand
// name never appears in copy or metadata). Pitches a 90-day creative
// engine on a $1,500/month subscription. The long-form breakdown
// (every deliverable, three channels, comparable case study, final
// CTA pair) lives at /meta/proposal/full — this page exists to land
// the elevator pitch and route through a single "More info" click.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProposalClient } from "./ProposalClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/meta/proposal`;

export const metadata: Metadata = {
  title: "Meta + YouTube Growth Proposal · 90 Days for $1,500/mo",
  description:
    "A 90-day Meta + YouTube + Instagram creative engine for behavioral-health and recovery centers on a $1,500/month subscription. Tap through for the full breakdown — every deliverable, the open-market rate card, and the comparable case study.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Meta + YouTube Growth Proposal · 90 Days",
    description:
      "A 90-day paid-social creative engine on a $1,500/month subscription. 7-second pitch with a one-click jump to the full breakdown.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Meta%20%2B%20YouTube%20Growth%20Proposal&topic=90%20Days%20%C2%B7%20%241%2C500%2Fmo`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta + YouTube Growth Proposal · 90 Days",
    description:
      "90-day paid-social engine · $1,500/month · cancel anytime after month one. 7-second pitch — one click to the full breakdown.",
  },
  // Discreet pitch — keep it crawlable so Sita can share the link
  // freely but ranking isn't the point.
  robots: { index: true, follow: true },
};

export default function MetaProposalPage(): ReactNode {
  return <ProposalClient pageUrl={PAGE_URL} />;
}
