import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

// The federation cross-promo view is a client component (it fetches an
// admin-gated API with the omni_token bearer), and a client component
// cannot export `metadata` — so the metadata lives in this sibling layout,
// exactly as `/dashboard/analytics` does it.

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/federation",
  title: "Federation · Omni AI",
  description: "Cross-promo funnel, attribution, and creative roster for the federation.",
  noindex: true,
  imageTitle: "Federation Cross-Promo",
  imageTopic: "Cross-promo funnel and attribution across the federation",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardFederationLayout({ children }: { children: ReactNode }) {
  return children;
}
