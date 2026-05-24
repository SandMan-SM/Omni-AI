// /renelaveau/contract — private 7-second pitch page for Rene
// Laveau's 4-month content engagement ($300/mo × 4 = $1,200 for
// ~30K monthly views, in exchange for him sending us videos of
// his music). Architecture mirrors /alira/referral (teaser shape)
// + the pricing modal mechanic from /alira/referral/full.
//
// Server Component wrapper; the long body + the dual-pay modal
// live in the Client Component. Stripe URLs are passed in as
// props so the route file is the single source of truth for
// "what does Activate Assets cost".
//
// Privacy: robots noindex/nofollow. URL is the gate — Sita shares
// it with Rene directly.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RenelaveauContractClient } from "./RenelaveauContractClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/renelaveau/contract`;

// ⚠️ Stripe payment links — currently placeholders.
//
// To wire payment for real:
//   1. In the Stripe dashboard, create a Product (e.g. "Rene
//      Laveau · Content Engagement · 4-month wave")
//   2. Add two Prices under it:
//        a. $300/month recurring (cancel after 4 invoices)
//        b. $1,200 one-time
//   3. Open each Price → "Create payment link" → copy the
//      https://buy.stripe.com/... URL
//   4. Replace the two constants below with the real URLs
//
// While the constants are "#", the modal buttons render but a
// click pops an alert directing Rene to call Sita. Sita changes
// two lines once Stripe is configured and the modal goes live
// with zero other code changes.
const PAY_MONTHLY_URL = "#"; // TODO: paste Stripe $300/mo recurring payment link here
const PAY_FULL_URL = "#"; // TODO: paste Stripe $1,200 one-time payment link here

export const metadata: Metadata = {
  title: "Content Engagement · Rene Laveau × Interlinked",
  description:
    "30,000 views a month for $300 a month, four months. Send us the videos of your music — we turn them into the audience.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

export default function RenelaveauContractPage(): ReactNode {
  return (
    <RenelaveauContractClient
      pageUrl={PAGE_URL}
      payMonthlyUrl={PAY_MONTHLY_URL}
      payFullUrl={PAY_FULL_URL}
    />
  );
}
