import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/campaigns",
  title: "Campaigns | Omni AI Dashboard",
  description: "Autonomous campaign runs across the federation — targeting, seniority mix, and per-campaign status.",
  noindex: true,
  imageTitle: "Campaigns",
  imageTopic: "Autonomous campaign runs",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardCampaignsLayout({ children }: { children: ReactNode }) {
  return children;
}
