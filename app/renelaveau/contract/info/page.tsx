// /renelaveau/contract/info — deeper "Learn more" surface for the
// Rene Laveau content engagement at /renelaveau/contract. The
// parent contract page stays a 7-second pitch; this page carries
// the substance for Rene if he wants to look under the hood
// before clicking Activate Assets.
//
// Server Component wrapper, noindex/nofollow (inherits the same
// gating posture as the parent contract page — URL is the gate).
// Long body + the interactive sliding savings chart live in the
// Client Component sibling.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RenelaveauInfoClient } from "./RenelaveauInfoClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/renelaveau/contract/info`;

// Branded OG image — distinct from the contract page so when
// Rene shares either link separately the preview reads as the
// right surface. Both feed /api/og which renders a 1200×630 PNG
// at request time from the title + topic query params.
const OG_IMAGE = `${SITE_URL}/api/og?title=Under%20the%20Hood%20%C2%B7%20Rene%20Laveau&topic=Federation%20Distribution%20%2B%20%24100K%2B%20in%20Self-Generating%20Assets`;

export const metadata: Metadata = {
  title: "Under the Hood · Rene Laveau × Interlinked",
  description:
    "What's running underneath the 4-month wave — federation distribution, calling agents, personal assistants, $100K+ in self-generating assets for pennies on the dollar.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Under the Hood · Rene Laveau × Interlinked",
    description:
      "Federation distribution, calling agents, personal assistants, and $100K+ in self-generating assets — what's running underneath the 4-month wave.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Under the Hood · Rene Laveau × Interlinked",
    description:
      "Federation distribution, calling agents, $100K+ in self-generating assets — what's underneath the wave.",
    images: [OG_IMAGE],
  },
  robots: { index: false, follow: false },
};

export default function RenelaveauContractInfoPage(): ReactNode {
  return <RenelaveauInfoClient pageUrl={PAGE_URL} />;
}
