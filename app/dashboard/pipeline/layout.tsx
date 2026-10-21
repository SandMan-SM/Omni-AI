import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/pipeline",
  title: "Pipeline | Omni AI Dashboard",
  description: "Deal pipeline across federation businesses — stage, deal value, and contact detail for every open opportunity.",
  noindex: true,
  imageTitle: "Pipeline",
  imageTopic: "Deals across every federation business",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardPipelineLayout({ children }: { children: ReactNode }) {
  return children;
}
