// /sponsor/blakehasson — private sponsorship teaser for Blake Hasson.
// Same architecture as /sponsor/delhasson; renders the shared
// SponsorTeaserClient with Blake's props plugged in.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SponsorTeaserClient } from "../_components/SponsorTeaserClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/blakehasson`;

const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20Blake%20Hasson%20%C3%97%20Interlinked&topic=Up%20to%20%24100K%20in%20Assets%20%C2%B7%204%20Tiers%20%C2%B7%20Hasson%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship Agreement · Blake Hasson · Interlinked by Sitani Mafi",
  description:
    "Private sponsorship summary prepared for Blake Hasson by Sitani Mafi (Interlinked). Four tiers up to $100K+ in delivered digital assets, optional recovery + equity track, Hasson Enterprises personal-brand build.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · Blake Hasson × Interlinked",
    description:
      "Up to $100K+ in delivered digital assets across 4 tiers. Hasson Enterprises personal-brand build included. Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · Blake Hasson × Interlinked",
    description:
      "Up to $100K+ in assets across 4 tiers. Hasson Enterprises included. Pre-signed by Sitani.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function BlakeHassonSponsorPage(): ReactNode {
  return (
    <SponsorTeaserClient
      pageUrl={PAGE_URL}
      sponsorName="Blake Hasson"
      brandHook="Hasson Enterprises"
      signEndpoint="/api/sponsor/blakehasson/sign"
      infoHref="/sponsor/blakehasson/info"
      sitaniSignedDate="May 25, 2026"
    />
  );
}
