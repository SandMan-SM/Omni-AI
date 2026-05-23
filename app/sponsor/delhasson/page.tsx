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

export const metadata: Metadata = {
  title: "Sponsorship Agreement · Del Hasson · Interlinked by Sitani Mafi",
  description:
    "Private sponsorship summary prepared for Del Hasson by Sitani Mafi (Interlinked). Contribution tiers, delivered asset value, optional recovery + equity track, and the e-sign surface to lock in your tier.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

export default function DelHassonSponsorPage(): ReactNode {
  return <DelHassonClient pageUrl={PAGE_URL} />;
}
