import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/analytics",
  title: "Analytics | Omni AI Dashboard",
  description: "Lead sources, status distribution, outreach asset status, and quality indicators across the federation.",
  noindex: true,
  imageTitle: "Analytics",
  imageTopic: "Lead sources, status, and quality indicators",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardAnalyticsLayout({ children }: { children: ReactNode }) {
  return children;
}
