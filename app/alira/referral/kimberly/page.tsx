// /alira/referral/kimberly — dedicated referral surface for
// Kimberly, one of the featured Alira creators Sita is sending
// leads through. Same shape as /alira/referral/jules: hero +
// proof copy interpolate "Kimberly sent you" / "When Kimberly
// sent you" in place of the canonical Jana defaults; OG/Twitter
// previews show "Referred by Kimberly"; Stripe attribution lands
// as `client_reference_id=REFERRER=KIMBERLY` on the checkout
// session so conversions can be credited to her.
//
// Static segment — takes routing priority over the dynamic
// /alira/referral/[code] EMPIRE=… affiliate route. The /info
// deep-dive carries the referrer forward via ?ref=kimberly.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AliraReferralClient } from "../AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/alira/referral/kimberly`;

// Stripe Payment Links are inline constants inside
// AliraReferralClient itself — both prices live under Alira
// product prod_UWQgOQqLHioU4d and the per-referrer attribution
// rides on the client_reference_id query param the client
// appends in onPay. This page only needs to pass pageUrl +
// referrerName + learnMoreHref.

// Branded OG image — interpolates "Referred by Kimberly" into
// the /api/og Edge-rendered preview so iMessage / Twitter /
// LinkedIn link unfurls match the page's body copy attribution.
const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Kimberly&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2020%C3%97%20ROI`;

export const metadata: Metadata = {
  title: "Referred by Kimberly · Federation Referral",
  description:
    "$60,000+ in self-generating digital assets for $3,000 — $300 down + $300/mo over 9 months, or $3,000 in full. 20× ROI. 4-month build. 100% delivery guarantee. Kimberly sent you.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referred by Kimberly · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. The referral-rate Tier-3 build. Kimberly sent you.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Referred by Kimberly · Federation Referral",
    description:
      "$60K in assets for $3,000. 20× ROI. 100% guarantee. We don't even want the money. — Kimberly",
    images: [OG_IMAGE],
  },
  // Private referral surface — only people Kimberly sends here see it.
  robots: { index: false, follow: false },
};

export default function AliraReferralKimberlyPage(): ReactNode {
  return (
    <AliraReferralClient
      pageUrl={PAGE_URL}
      referrerName="Kimberly"
      learnMoreHref="/alira/referral/info?ref=kimberly"
    />
  );
}
