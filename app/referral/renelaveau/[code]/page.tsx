// /referral/renelaveau/[code] — dynamic affiliate / referral
// route. Captures the URL segment (e.g. EMPIRE=G59713666) and
// hands it through to the existing RenelaveauReferralClient as
// the `affiliateCode` prop. The client then:
//   - Renders a small "Referred · <code>" pill in the hero so
//     the visitor sees the attribution is live
//   - Appends `?client_reference_id=<code>` to both Stripe
//     Payment Link URLs before they open, so the conversion
//     lands on the checkout session with the referrer baked in.
//     Sita's downstream Stripe webhook (or manual reconciliation)
//     reads client_reference_id off checkout.session.completed
//     to credit the right affiliate when the payment clears.
//
// The static `/referral/renelaveau/info` segment takes routing
// priority over this dynamic one in Next App Router, so the
// info page is unaffected — only "arbitrary other paths" hit
// this handler. We validate the code shape (uppercase prefix +
// "=" + alphanumeric tail) and 404 anything else so this route
// can't be used as an open redirect or garbage-rendering
// surface.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RenelaveauReferralClient } from "../RenelaveauReferralClient";

const SITE_URL = "https://omnileadsagi.com";

// Same live Stripe payment links the bare /referral/renelaveau
// route uses. Both prices sit under the same product, so all
// conversions (bare URL + every affiliate URL) report cleanly
// under "Rene Laveau · Referral Build · 10-month engagement"
// in the Stripe dashboard — the client_reference_id is what
// distinguishes one affiliate from another, not the Stripe
// link itself.
const PAY_MONTHLY_URL = "https://buy.stripe.com/8x26oH1f44eAcvJgkU9fW0k";
const PAY_FULL_URL = "https://buy.stripe.com/8x29AT0b08uQgLZc4E9fW0l";

// Affiliate code shape: uppercase prefix (e.g. "EMPIRE"),
// literal "=", then 4–32 alphanumeric chars. Anything else
// returns 404 so the route can't be hit with arbitrary garbage.
// If new prefix conventions land later (e.g. "PARTNER=…"), this
// regex is the single place to widen.
const AFFILIATE_CODE_RE = /^[A-Z]{3,16}=[A-Z0-9]{4,32}$/;

type PageProps = {
  params: { code: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  const code = decodeURIComponent(params.code);
  const PAGE_URL = `${SITE_URL}/referral/renelaveau/${encodeURIComponent(code)}`;
  const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Rene%20Laveau&topic=%2460K%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%20100%25%20Guarantee`;

  return {
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
    robots: { index: false, follow: false },
  };
}

export default function RenelaveauReferralCodePage({
  params,
}: PageProps): ReactNode {
  // Decode + uppercase the captured segment. The URL is
  // case-insensitive for tracking purposes, but the canonical
  // form is uppercase to match Sita's convention ("EMPIRE=…").
  const rawCode = decodeURIComponent(params.code).toUpperCase();

  if (!AFFILIATE_CODE_RE.test(rawCode)) {
    notFound();
  }

  const PAGE_URL = `${SITE_URL}/referral/renelaveau/${encodeURIComponent(rawCode)}`;

  return (
    <RenelaveauReferralClient
      pageUrl={PAGE_URL}
      payMonthlyUrl={PAY_MONTHLY_URL}
      payFullUrl={PAY_FULL_URL}
      affiliateCode={rawCode}
    />
  );
}
