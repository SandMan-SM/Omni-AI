import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/runs",
  title: "Agent Runs | Omni AI Dashboard",
  description: "Long-running agent tasks — autopilot runs, bulk operations, and their completion state.",
  noindex: true,
  imageTitle: "Agent Runs",
  imageTopic: "Autopilot runs and bulk operations",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardRunsLayout({ children }: { children: ReactNode }) {
  return children;
}
