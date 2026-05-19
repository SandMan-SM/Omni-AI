// /alira/referral — 7-second teaser surface for the Alira federation
// referral. The long-form breakdown (leverage callout, chip strip,
// open-market value table, PROOF card, pricing modal with two ways
// to pay, distribution + community grid, why-this-is-different
// section, AES-256 final CTA) lives at /alira/referral/full — this
// page exists to land the elevator pitch and route through a single
// "More info" click.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "./AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral`;

export const metadata: Metadata = {
  title: "Locked in by Alira · Federation Referral",
  description:
    "Alira sent you because the build behind her brand isn't a website — it's an audience engine. The federation seat at the referral rate. Tap through for the full breakdown — every deliverable, the open-market value anchor, the case study, and the two ways to secure your seat.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Locked in by Alira · Federation Referral",
    description:
      "The federation seat. We don't even want the money. 7-second pitch — one click to the full breakdown.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=Federation%20Referral`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Locked in by Alira · Federation Referral",
    description:
      "The federation seat. We don't even want the money. 7-second pitch — one click to the full breakdown.",
    images: [`${SITE_URL}/api/og?title=Locked%20in%20by%20Alira&topic=Federation%20Referral`],
  },
  // Private referral surface — only people Alira sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralPage(): ReactNode {
  return <AliraReferralClient pageUrl={PAGE_URL} />;
}
