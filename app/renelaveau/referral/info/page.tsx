// /renelaveau/referral/info — under-the-hood breakdown for the
// referral surface at /renelaveau/referral. Carries the substance
// for operators who want to see exactly what's in the $60K stack
// before clicking Activate Assets on the parent page.
//
// Server Component wrapper, noindex/nofollow (same gating posture
// as the parent referral page). All body + the interactive
// savings chart + the dual Activate Assets CTAs live in the
// Client Component sibling.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RenelaveauReferralInfoClient } from "./RenelaveauReferralInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/renelaveau/referral/info`;

// Branded OG image — distinct from the parent referral page so
// when the info link is shared separately, the preview reads as
// the right surface.
const OG_IMAGE = `${SITE_URL}/api/og?title=Under%20the%20Hood%20%C2%B7%20Referred%20by%20Rene%20Laveau&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%20100%25%20Guarantee`;

export const metadata: Metadata = {
  title: "Under the Hood · Referred by Rene Laveau",
  description:
    "What's actually in the $60K stack — federation distribution, personal AI assistants, $60,000+ in self-generating assets for $3,000.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Under the Hood · Referred by Rene Laveau",
    description:
      "Federation distribution, personal AI assistants, $60,000+ in self-generating assets — what's actually in the $60K stack.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Under the Hood · Referred by Rene Laveau",
    description:
      "$60K in assets for $3,000. 20x ROI. 100% guarantee. What's actually under the hood.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function RenelaveauReferralInfoPage(): ReactNode {
  return <RenelaveauReferralInfoClient pageUrl={PAGE_URL} />;
}
