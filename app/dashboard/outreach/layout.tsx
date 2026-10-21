import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/outreach",
  title: "Outreach Engine | Omni AI Dashboard",
  description: "Generate and sequence outbound — three-touch email sequences, audience targeting, and send status.",
  noindex: true,
  imageTitle: "Outreach Engine",
  imageTopic: "Generate and sequence outbound",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardOutreachLayout({ children }: { children: ReactNode }) {
  return children;
}
