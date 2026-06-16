// /meta — public funnel for the productized "Meta Ads, Managed by AI"
// offer: a fully AI-run Facebook + Instagram ad engine on a flat
// $1,500/month subscription. Built on the same visual system as
// /meta/proposal (cosmic ProposalBackdrop + GoldSparksBackdrop, amber
// palette, serif headlines, scope-at-a-glance tiles, chrome-flash CTA)
// but this is a self-serve sales page: the PayPal $1,500/mo
// subscription button sits right on the page (hero side-card + final
// CTA) so a visitor can subscribe in one tap.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MetaClient } from "./MetaClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/meta`;

// PayPal public Client ID (publishable — safe in the browser/repo, like
// a Stripe publishable key). Baked in so the live deploy works without a
// Vercel env var. Pairs with plan P-0CW08001LU923782MNIUHR6I ($1,500/mo).
// Same app + plan used on /meta/proposal/full.
const PAYPAL_CLIENT_ID =
  "AW72P6A-yKEg77Tkh866rDoce2DKYU2EUhGKQp-401eIFKpSERKCOETvqtcSYTVTN4rnFbvBt6vP6Lf4";
const PAYPAL_PLAN_ID = "P-0CW08001LU923782MNIUHR6I";

export const metadata: Metadata = {
  title: "Meta Ads, Managed by AI · $1,500/mo",
  description:
    "A done-for-you Facebook + Instagram ad engine, run end to end by AI for a flat $1,500/month. Fresh creative every week, 24/7 optimization, no long-term contract. Subscribe in one tap.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Meta Ads, Managed by AI · $1,500/mo",
    description:
      "Your Facebook + Instagram ads, run by AI every day. Flat $1,500/month, fresh creative weekly, 24/7 optimization, cancel anytime after month one.",
    url: PAGE_URL,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/api/og?title=Meta%20Ads%2C%20Managed%20by%20AI&topic=%241%2C500%2Fmo%20%C2%B7%20Done-for-you`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta Ads, Managed by AI · $1,500/mo",
    description:
      "A done-for-you Facebook + Instagram ad engine, run end to end by AI. Flat $1,500/month, cancel anytime after month one.",
  },
  robots: { index: true, follow: true },
};

export default function MetaPage(): ReactNode {
  return (
    <MetaClient
      pageUrl={PAGE_URL}
      paypalClientId={PAYPAL_CLIENT_ID}
      paypalPlanId={PAYPAL_PLAN_ID}
    />
  );
}
