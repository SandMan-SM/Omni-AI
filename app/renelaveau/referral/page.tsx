// /renelaveau/referral — private referral-rate offer for the
// people Rene Laveau sends our way. $3,000 over 10 months (or
// paid in full) buys ~$60K in federation-grade digital assets:
// Tier-3 bespoke site, AI CEO layer, calling agents, branded
// newsletter, federation cross-promo distribution. 20x ROI on
// open-market value, 4-month build period, 100% delivery
// guarantee.
//
// Architecture mirrors /renelaveau/contract — same teaser-page
// shape + dual-pay modal mechanic, different commercial terms.
// Stripe URLs come in as props so the route file is the single
// source of truth for "what does the referral offer cost".

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RenelaveauReferralClient } from "./RenelaveauReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/renelaveau/referral`;

// Live Stripe payment links — created via Stripe MCP on
// 2026-05-24 against the Omni AI account (acct_1THX7kE1uHPZaaHp).
// Both prices sit under a single product so reporting groups them
// cleanly under one engagement line in the Stripe dashboard.
//
//   Product:  prod_UZqqaMDTFNuNbC
//             "Rene Laveau · Referral Build · 10-month engagement"
//   Prices:   price_1Tah8iE1uHPZaaHpEnzEmalt ($300/mo recurring)
//             price_1Tah8qE1uHPZaaHpZkWJbl3o ($3,000 one-time)
//   Links:    plink_1Tah93E1uHPZaaHpM7Hbhnnn
//             plink_1Tah97E1uHPZaaHpWdx8zz1l
//
// Operational note on the 10-month cap: same caveat as the
// /renelaveau/contract product. Stripe Prices don't carry a
// built-in "cancel after N invoices" knob, so the 10-month
// recurring cap is enforced operationally (Sita cancels the
// subscription after the 10th paid invoice) until we ship the
// invoice.paid webhook handler that auto-cancels at N.
const PAY_MONTHLY_URL = "https://buy.stripe.com/8x26oH1f44eAcvJgkU9fW0k";
const PAY_FULL_URL = "https://buy.stripe.com/8x29AT0b08uQgLZc4E9fW0l";

// Branded OG image generated dynamically by /api/og from the
// title + topic query params. Renders a 1200×630 PNG at request
// time so the link preview matches the page's visual language
// when shared in iMessage / Twitter / LinkedIn. Same pattern
// used on the /renelaveau/contract surfaces.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Rene%20Laveau&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%20100%25%20Guarantee`;

export const metadata: Metadata = {
  title: "Referred by Rene Laveau · Federation Referral",
  description:
    "$60,000+ in self-generating digital assets for $3,000 — paid as $300/month for 10 months or $3,000 in full. 20x ROI. 4-month build. 100% guarantee.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Rene Laveau · Federation Referral",
    description:
      "$60K in assets for $3,000. 20x ROI. 100% guarantee. The referral-rate Tier-3 build.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Rene Laveau · Federation Referral",
    description:
      "$60K in assets for $3,000. 20x ROI. 100% guarantee. The referral-rate Tier-3 build.",
    images: [OG_IMAGE],
  },
  // Private referral surface — only people Rene sends here see it.
  robots: { index: false, follow: false },
};

export default function RenelaveauReferralPage(): ReactNode {
  return (
    <RenelaveauReferralClient
      pageUrl={PAGE_URL}
      payMonthlyUrl={PAY_MONTHLY_URL}
      payFullUrl={PAY_FULL_URL}
    />
  );
}
