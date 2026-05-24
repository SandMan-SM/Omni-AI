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

// Live Stripe payment links — created via Stripe MCP on
// 2026-05-24 against the Omni AI account (acct_1THX7kE1uHPZaaHp).
// Both prices sit under a single product so reporting groups them
// cleanly under one engagement line in the Stripe dashboard.
//
//   Product:  prod_UZpMlS7YWCnmLm
//             "Rene Laveau · Content Engagement · 4-month wave"
//   Prices:   price_1TafhjE1uHPZaaHpIHFvgNYD ($300/mo recurring)
//             price_1TafhrE1uHPZaaHpPnaMUHTS ($1,200 one-time)
//   Links:    plink_1Tafi1E1uHPZaaHpQWHWBTCV
//             plink_1Tafi8E1uHPZaaHpqzg0hWWx
//
// Note on the monthly cadence: Stripe Prices don't carry a built-in
// "cancel after N invoices" knob; the 4-month cap on the recurring
// option is enforced operationally by Sita canceling Rene's
// subscription after the 4th successful invoice (or wiring a small
// webhook handler that auto-cancels on the 4th invoice.paid event —
// queued as a v2 if Rene chooses monthly).
const PAY_MONTHLY_URL = "https://buy.stripe.com/eVq5kDg9YdPabrFc4E9fW0i";
const PAY_FULL_URL = "https://buy.stripe.com/00w6oHbTIh1m8ft2u49fW0j";

// Branded OG image generated dynamically by /api/og from the title
// + topic query params. Builds a 1200×630 PNG at request time so
// the iMessage / Twitter / LinkedIn link preview matches the
// page's visual language instead of falling back to whatever the
// platform synthesizes from the bare HTML. Same pattern used on
// the Alira and Del Hasson surfaces.
const OG_IMAGE = `${SITE_URL}/api/og?title=Rene%20Laveau%20%C3%97%20Interlinked&topic=30K%20Views%20a%20Month%20%C2%B7%20%24300%2Fmo%20%C2%B7%204%20Months`;

export const metadata: Metadata = {
  title: "Content Engagement · Rene Laveau × Interlinked",
  description:
    "30,000 views a month for $300 a month, four months. Send us the videos of your music — we turn them into the audience.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "30K views a month · Rene Laveau × Interlinked",
    description:
      "$300/mo for 4 months. Just send the music — we turn it into the audience.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "30K views a month · Rene Laveau × Interlinked",
    description:
      "$300/mo for 4 months. Just send the music — we turn it into the audience.",
    images: [OG_IMAGE],
  },
  // Private contract surface — never indexed; sharing happens via
  // direct link in DM. OG + Twitter cards still render in the
  // preview though (noindex only affects search crawlers, not
  // unfurlers).
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
