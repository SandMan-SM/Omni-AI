// /lovethybarber/referral — full-architecture referral surface matching
// the Rene Laveau referral page (hero with dual CTAs + 5-tile
// scope + value table + timeline + proof + performance terms +
// in-page activate modal). Restructured from the 7-second
// teaser → /full deep-dive pattern; the /full long-form still
// lives at /lovethybarber/referral/full for the deeper read.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LoveThyBarberReferralClient } from "./LoveThyBarberReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/lovethybarber/referral`;

// Branded OG image — emphasizes the deal math ($200K+ in
// assets / $3,000 / 67× ROI) in the link-preview card when
// shared in iMessage / Twitter / LinkedIn. Renders via /api/og
// (Edge route) at request time. Same pattern as the Rene
// referral OG.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Love%20Thy%20Barber&topic=%2460K%2B%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;

export const metadata: Metadata = {
  title: "Referred by Love Thy Barber · Federation Referral",
  description:
    "$60,000+ in self-generating digital assets for $3,000 — $300 down + $300/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Love Thy Barber · Federation Referral",
    description:
      "$60K+ in assets for $3,000. 20× ROI. 100% guarantee. The referral-rate Tier-3 build.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Love Thy Barber · Federation Referral",
    description:
      "$60K+ in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money.",
    images: [OG_IMAGE],
  },
  // Private referral surface — only people Love Thy Barber sends here see it.
  robots: { index: false, follow: false },
};

export default function LoveThyBarberReferralPage(): ReactNode {
  return <LoveThyBarberReferralClient pageUrl={PAGE_URL} />;
}
