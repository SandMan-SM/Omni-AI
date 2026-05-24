// /alira/referral — full-architecture referral surface matching
// the Rene Laveau referral page (hero with dual CTAs + 5-tile
// scope + value table + timeline + proof + performance terms +
// in-page activate modal). Restructured from the 7-second
// teaser → /full deep-dive pattern; the /full long-form still
// lives at /alira/referral/full for the deeper read.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "./AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral`;

// Branded OG image — emphasizes the deal math ($200K+ in
// assets / $3,000 / 67× ROI) in the link-preview card when
// shared in iMessage / Twitter / LinkedIn. Renders via /api/og
// (Edge route) at request time. Same pattern as the Rene
// referral OG.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Alira&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;

export const metadata: Metadata = {
  title: "Referred by Alira · Federation Referral",
  description:
    "$60,000+ in self-generating digital assets for $3,000 — $333 down + $333/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Alira · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. The referral-rate Tier-3 build.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Alira · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money.",
    images: [OG_IMAGE],
  },
  // Private referral surface — only people Alira sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralPage(): ReactNode {
  return <AliraReferralClient pageUrl={PAGE_URL} />;
}
