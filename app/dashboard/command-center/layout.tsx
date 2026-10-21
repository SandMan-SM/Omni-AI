import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/command-center",
  title: "Command Center | Omni AI Dashboard",
  description: "Per-brand command center — active runs and performance over the trailing seven days.",
  noindex: true,
  imageTitle: "Command Center",
  imageTopic: "Per-brand runs and performance",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardCommandCenterLayout({ children }: { children: ReactNode }) {
  return children;
}
