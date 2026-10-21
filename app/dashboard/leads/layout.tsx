import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/leads",
  title: "Leads | Omni AI Dashboard",
  description: "Lead queue across every business in the federation — statuses, sources, profiles, and outreach readiness.",
  noindex: true,
  imageTitle: "Leads",
  imageTopic: "Federation-wide lead queue",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardLeadsLayout({ children }: { children: ReactNode }) {
  return children;
}
