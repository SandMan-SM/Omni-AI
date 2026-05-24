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

export const metadata: Metadata = {
  title: "Under the Hood · Rene Laveau × Interlinked",
  description:
    "What's running underneath the 4-month wave — federation distribution, calling agents, personal assistants, $100K+ in self-generating assets for pennies on the dollar.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

export default function RenelaveauContractInfoPage(): ReactNode {
  return <RenelaveauInfoClient pageUrl={PAGE_URL} />;
}
