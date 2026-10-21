import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/heatmap",
  title: "Heatmap | Omni AI Dashboard",
  description: "Federation activity heatmap — where agent and operator activity concentrates across businesses and surfaces.",
  noindex: true,
  imageTitle: "Heatmap",
  imageTopic: "Where federation activity concentrates",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardHeatmapLayout({ children }: { children: ReactNode }) {
  return children;
}
