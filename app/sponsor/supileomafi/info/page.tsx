// /sponsor/supileomafi/info — full breakdown for Supileo Mafi's
// sponsorship. Same architecture as /sponsor/delhasson/info.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SponsorInfoClient } from "../../_components/SponsorInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/supileomafi/info`;

const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20Supileo%20Mafi%20%C2%B7%20Full%20Breakdown&topic=8%20Sections%20%C2%B7%20Up%20to%20%24100K%20in%20Assets%20%C2%B7%20Mafi%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship · Supileo Mafi · Full Breakdown",
  description:
    "Full breakdown of the Supileo Mafi sponsorship — 8 sections covering the overview, 4 tiers, what gets built (with savings-at-scale math), optional contribution recovery + equity track, proof + Live Better / Alira case studies, the Mafi Enterprises personal-brand hook, and terms.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · Supileo Mafi · Full Breakdown",
    description:
      "8 sections · Up to $100K in Assets · Mafi Enterprises personal-brand build · Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · Supileo Mafi · Full Breakdown",
    description:
      "8 sections, up to $100K in assets, Mafi Enterprises included. Pre-signed.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function SupileoMafiInfoPage(): ReactNode {
  return (
    <SponsorInfoClient
      pageUrl={PAGE_URL}
      sponsorName="Supileo Mafi"
      sponsorFirstName="Supileo"
      brandHook="Mafi Enterprises"
      signEndpoint="/api/sponsor/supileomafi/sign"
      teaserHref="/sponsor/supileomafi"
      sitaniSignedDate="May 25, 2026"
    />
  );
}
