import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/marketing",
  title: "Marketing Console | Omni AI Dashboard",
  description: "Marketing console — landing pages, daily trending content, and campaign runner status.",
  noindex: true,
  imageTitle: "Marketing Console",
  imageTopic: "Landings, trends, and runner status",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardMarketingLayout({ children }: { children: ReactNode }) {
  return children;
}
