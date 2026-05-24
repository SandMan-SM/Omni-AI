// /sponsor/delhasson/info — full breakdown of the Del Hasson
// sponsorship agreement. Was the body of the original
// monolithic /sponsor/delhasson page; refactored out so the
// teaser stays 7-second-readable and the long-form §1–§8
// content (with the savings chart + LB/Alira proof cards +
// Hasson Enterprises hook) lives behind the Learn more CTA.
//
// Inherits robots: noindex, nofollow from the parent /sponsor
// layout. Activate Sponsorship buttons here open the same
// shared SignModal used on the teaser.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DelHassonInfoClient } from "./DelHassonInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/delhasson/info`;

// Branded OG image — same /api/og Edge-route pattern used on
// the teaser, retitled to "Full Breakdown" so the link preview
// distinguishes the two surfaces when each is shared
// separately.
const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20Del%20Hasson%20%C2%B7%20Full%20Breakdown&topic=8%20Sections%20%C2%B7%20Up%20to%20%24100K%20in%20Assets%20%C2%B7%20Hasson%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship · Del Hasson · Full Breakdown",
  description:
    "Full breakdown of the Del Hasson sponsorship — 8 sections covering the overview, 4 tiers, what gets built (with the savings-at-scale chart), optional contribution recovery + equity trade, equity & partnership track, proof of execution + Live Better / Alira case studies, the Hasson Enterprises personal-brand hook, and terms.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · Del Hasson · Full Breakdown",
    description:
      "8 sections · Up to $100K in Assets · Hasson Enterprises personal-brand build · Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · Del Hasson · Full Breakdown",
    description:
      "8 sections, up to $100K in assets, Hasson Enterprises included. Pre-signed.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function DelHassonInfoPage(): ReactNode {
  return <DelHassonInfoClient pageUrl={PAGE_URL} />;
}
