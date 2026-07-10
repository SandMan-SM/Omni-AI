// /proposal/elitalks — strategic partnership proposal between Omni AI
// and the Ellie Talks podcast (Ellie). 3-month partnership; pricing
// is intentionally NOT surfaced on this page per Ben's 2026-05-13
// feedback ("take out costs from this site and give me costs in a
// text paragraph here"). Ben handles the price negotiation with
// Natalie directly — this surface is the relationship-trust artifact,
// not a self-serve checkout.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EliTalksClient } from "./EliTalksClient";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/proposal/elitalks`;

// Long-form constants (distribution / tracking / about / comparable)
// live exclusively on /proposal/elitalks/full/page.tsx now — the
// teaser surface doesn't need them. If they need to be shared again,
// lift them into a shared lib/elitalks-proposal-data.ts module.

export const metadata: Metadata = {
  title: "Omni AI × Ellie Talks · 3-Month Partnership",
  description:
    "Three months. One audience. A paid-social engine running across Meta, Instagram + YouTube, wired into the full Omni AI federation. Tap through for the full breakdown — every deliverable plus the Omni AI Exclusive Membership tier.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Omni AI × Ellie Talks · 3-Month Partnership",
    description:
      "A paid-social engine across Meta + YouTube, plugged into the Omni AI federation. 7-second pitch with a one-click jump to the full breakdown.",
    url: PAGE_URL,
    type: "website",
    images: [{
      url: `${SITE_URL}/api/og?title=Omni%20AI%20%C3%97%20Ellie%20Talks&topic=3-Month%20Partnership%20Proposal`,
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI × Ellie Talks · 3-Month Partnership",
    description:
      "Paid-social engine across Meta + YouTube + federation amplification. 7-second pitch — one click to the full breakdown.",
  },
  robots: { index: false, follow: false },
};

export default function EliTalksProposalPage(): ReactNode {
  return <EliTalksClient pageUrl={PAGE_URL} />;
}
