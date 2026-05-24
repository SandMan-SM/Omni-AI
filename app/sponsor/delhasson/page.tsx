// /sponsor/delhasson — private sponsorship summary + e-sign surface for
// the Del Hasson sponsorship agreement. Inherits the parent /sponsor
// layout's robots: noindex, nofollow so the page never enters Google's
// index even though it lives on the public domain. The page is shared
// privately via direct URL; only the recipient (Del) sees the contract.
//
// Architecture mirrors /alira/referral/full — a single Server Component
// wrapper that hands the long-form content + signature form off to a
// Client Component (DelHassonClient). Sitani's signature is pre-rendered
// on the page so Del lands on an already-half-executed document and only
// has to add his own name + date.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DelHassonClient } from "./DelHassonClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/sponsor/delhasson`;

// Branded OG image surfaces the deal frame ("Sponsorship · Del
// Hasson × Interlinked / Up to $100K in Assets · 4 Tiers ·
// Hasson Enterprises") in iMessage / Twitter / LinkedIn link
// previews. Renders via /api/og — the Edge route that builds a
// 1200×630 PNG at request time from title + topic query params.
// Same pattern used on every other private contract/referral
// surface in the repo.
const OG_IMAGE = `${SITE_URL}/api/og?title=Sponsorship%20%C2%B7%20Del%20Hasson%20%C3%97%20Interlinked&topic=Up%20to%20%24100K%20in%20Assets%20%C2%B7%204%20Tiers%20%C2%B7%20Hasson%20Enterprises`;

export const metadata: Metadata = {
  title: "Sponsorship Agreement · Del Hasson · Interlinked by Sitani Mafi",
  description:
    "Private sponsorship summary prepared for Del Hasson by Sitani Mafi (Interlinked). Four tiers up to $100K+ in delivered digital assets, optional recovery + equity track, Hasson Enterprises personal-brand build, and the e-sign surface to lock in your tier.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Sponsorship · Del Hasson × Interlinked",
    description:
      "Up to $100K+ in delivered digital assets across 4 tiers. Hasson Enterprises personal-brand build included. Pre-signed by Sitani Mafi.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship · Del Hasson × Interlinked",
    description:
      "Up to $100K+ in assets across 4 tiers. Hasson Enterprises included. Pre-signed by Sitani.",
    images: [OG_IMAGE],
  },
  // Private sponsorship surface — never indexed; Sita shares the
  // URL with Del directly. noindex only affects search crawlers
  // though, not link unfurlers — the OG/Twitter cards above
  // still render in the preview when the URL is shared in DM.
  robots: { index: false, follow: false },
};

export default function DelHassonSponsorPage(): ReactNode {
  return <DelHassonClient pageUrl={PAGE_URL} />;
}
