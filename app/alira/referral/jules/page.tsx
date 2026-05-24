// /alira/referral/jules — dedicated referral surface for Jules,
// one of the featured Alira creators Sita is sending leads
// through. Same shape as the bare /alira/referral page (Jana)
// but with every body-copy "Jana sent you" / "When Jana sent
// you" reference + the OG/Twitter card surfaces swapped to
// "Jules". Stripe attribution lands as
// `client_reference_id=REFERRER=JULES` on the checkout session
// so Sita can credit conversions to Jules in reconciliation.
//
// Static segment — takes routing priority over the dynamic
// /alira/referral/[code] EMPIRE=… affiliate route. The /info
// deep-dive carries the referrer forward via ?ref=jules.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "../AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral/jules`;

// Stripe Payment Links are inline constants inside
// AliraReferralClient itself — both prices live under Alira
// product prod_UWQgOQqLHioU4d and the per-referrer attribution
// rides on the client_reference_id query param the client
// appends in onPay. This page only needs to pass pageUrl +
// referrerName + learnMoreHref; Stripe URLs come from the
// client's own PAY_DEPOSIT_URL / PAY_FULL_URL constants.

// Branded OG image — interpolates "Referred by Jules" into the
// /api/og Edge-rendered preview so iMessage / Twitter / LinkedIn
// link unfurls match the page's body copy attribution.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Jules&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;

export const metadata: Metadata = {
  title: "Referred by Jules · Federation Referral",
  description:
    "$60,000+ in self-generating digital assets for $3,000 — $300 down + $300/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee. Jules sent you.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Jules · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. The referral-rate Tier-3 build. Jules sent you.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Jules · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money. — Jules",
    images: [OG_IMAGE],
  },
  // Private referral surface — only people Jules sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralJulesPage(): ReactNode {
  return (
    <AliraReferralClient
      pageUrl={PAGE_URL}
      referrerName="Jules"
      learnMoreHref="/alira/referral/info?ref=jules"
    />
  );
}
