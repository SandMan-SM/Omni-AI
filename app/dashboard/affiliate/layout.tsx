import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/affiliate",
  title: "Affiliate | Omni AI Dashboard",
  description: "Affiliate performance — referred deals, deal values, and commission attribution across the federation.",
  noindex: true,
  imageTitle: "Affiliate",
  imageTopic: "Referred deals and commissions",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardAffiliateLayout({ children }: { children: ReactNode }) {
  return children;
}
