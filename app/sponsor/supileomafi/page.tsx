// /sponsor/supileomafi — private sponsorship teaser for Supileo Mafi.
// Same architecture as /sponsor/delhasson; renders the shared
// SponsorTeaserClient with Supileo's props plugged in.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SponsorTeaserClient } from "../_components/SponsorTeaserClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/supileomafi`;

const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20Supileo%20Mafi%20%C3%97%20Interlinked&topic=Up%20to%20%24100K%20in%20Assets%20%C2%B7%204%20Tiers%20%C2%B7%20Mafi%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship Agreement · Supileo Mafi · Interlinked by Sitani Mafi",
  description:
    "Private sponsorship summary prepared for Supileo Mafi by Sitani Mafi (Interlinked). Four tiers up to $100K+ in delivered digital assets, optional recovery + equity track, Mafi Enterprises personal-brand build.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · Supileo Mafi × Interlinked",
    description:
      "Up to $100K+ in delivered digital assets across 4 tiers. Mafi Enterprises personal-brand build included. Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · Supileo Mafi × Interlinked",
    description:
      "Up to $100K+ in assets across 4 tiers. Mafi Enterprises included. Pre-signed by Sitani.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function SupileoMafiSponsorPage(): ReactNode {
  return (
    <SponsorTeaserClient
      pageUrl={PAGE_URL}
      sponsorName="Supileo Mafi"
      brandHook="Mafi Enterprises"
      signEndpoint="/api/sponsor/supileomafi/sign"
      infoHref="/sponsor/supileomafi/info"
      sitaniSignedDate="May 25, 2026"
    />
  );
}
