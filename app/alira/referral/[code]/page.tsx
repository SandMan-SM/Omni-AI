// /alira/referral/[code] — dynamic affiliate / referral route.
// Captures the URL segment (e.g. EMPIRE=A12345678) and hands it
// through to AliraReferralClient as the `affiliateCode` prop.
// The client then:
//   - Renders a small "Referred · <code>" pill in the hero so
//     the visitor sees the attribution is live
//   - Appends `?client_reference_id=<code>` to both Stripe
//     Payment Link URLs before they open, so the conversion
//     lands on the checkout session with the referrer baked in.
//     Sita's downstream webhook (or manual reconciliation) reads
//     client_reference_id off checkout.session.completed to
//     credit the right affiliate when the payment clears.
//
// The static `/alira/referral/full` segment takes routing
// priority over this dynamic one in Next App Router, so the
// existing /full deep-dive is unaffected — only "arbitrary
// other paths" hit this handler. We validate the code shape
// (uppercase prefix + "=" + alphanumeric tail) and 404 anything
// else so this route can't be used as an open redirect or
// garbage-rendering surface.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AliraReferralClient } from "../AliraReferralClient";

const SITE_URL = "https://omnileadsagi.com";

// Affiliate code shape: uppercase prefix (e.g. "EMPIRE"),
// literal "=", then 4–32 alphanumeric chars. Anything else
// returns 404 so the route can't be hit with arbitrary garbage.
// Matches the regex used by the Rene Laveau affiliate route.
const AFFILIATE_CODE_RE = /^[A-Z]{3,16}=[A-Z0-9]{4,32}$/;

type PageProps = {
  params: { code: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  const code = decodeURIComponent(params.code);
  const PAGE_URL = `${SITE_URL}/alira/referral/${encodeURIComponent(code)}`;
  const OG_IMAGE = `${SITE_URL}/api/og?title=Referred%20by%20Alira&topic=%24200K%2B%20in%20Assets%20%C2%B7%20%243%2C000%20%C2%B7%2067%C3%97%20ROI`;

  return {
    title: "Referred by Alira · Federation Referral",
    description:
      "$200,000+ in self-generating digital assets for $3,000 — $333 down + $333/mo over 9 months, or $3,000 in full. 67× ROI. 4-month build. 100% delivery guarantee.",
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: "Referred by Alira · Federation Referral",
      description:
        "$200K+ in assets for $3,000. 67× ROI. 100% guarantee. The referral-rate Tier-3 build.",
      url: PAGE_URL,
      type: "website",
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Referred by Alira · Federation Referral",
      description:
        "$200K+ in assets for $3,000. 67× ROI. 100% guarantee. We don't even want the money.",
      images: [OG_IMAGE],
    },
    robots: { index: false, follow: false },
  };
}

export default function AliraReferralCodePage({
  params,
}: PageProps): ReactNode {
  // Decode + uppercase the captured segment. The URL is
  // case-insensitive for tracking purposes, but the canonical
  // form is uppercase to match Sita's convention ("EMPIRE=…").
  const rawCode = decodeURIComponent(params.code).toUpperCase();

  if (!AFFILIATE_CODE_RE.test(rawCode)) {
    notFound();
  }

  const PAGE_URL = `${SITE_URL}/alira/referral/${encodeURIComponent(rawCode)}`;

  return (
    <AliraReferralClient pageUrl={PAGE_URL} affiliateCode={rawCode} />
  );
}
