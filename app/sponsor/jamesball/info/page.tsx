// /sponsor/jamesball/info — full breakdown for James Ball's
// sponsorship. Same architecture as /sponsor/delhasson/info.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SponsorInfoClient } from "../../_components/SponsorInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/jamesball/info`;

const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20James%20Ball%20%C2%B7%20Full%20Breakdown&topic=8%20Sections%20%C2%B7%20Up%20to%20%24100K%20in%20Assets%20%C2%B7%20Ball%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship · James Ball · Full Breakdown",
  description:
    "Full breakdown of the James Ball sponsorship — 8 sections covering the overview, 4 tiers, what gets built (with savings-at-scale math), optional contribution recovery + equity track, proof + Live Better / Alira case studies, the Ball Enterprises personal-brand hook, and terms.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · James Ball · Full Breakdown",
    description:
      "8 sections · Up to $100K in Assets · Ball Enterprises personal-brand build · Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · James Ball · Full Breakdown",
    description:
      "8 sections, up to $100K in assets, Ball Enterprises included. Pre-signed.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function JamesBallInfoPage(): ReactNode {
  return (
    <SponsorInfoClient
      pageUrl={PAGE_URL}
      sponsorName="James Ball"
      sponsorFirstName="James"
      brandHook="Ball Enterprises"
      signEndpoint="/api/sponsor/jamesball/sign"
      teaserHref="/sponsor/jamesball"
      sitaniSignedDate="May 25, 2026"
    />
  );
}
