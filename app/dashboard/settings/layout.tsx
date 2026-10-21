import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/settings",
  title: "Settings | Omni AI Dashboard",
  description: "Business profile and account settings for the Omni AI dashboard.",
  noindex: true,
  imageTitle: "Settings",
  imageTopic: "Business profile and account settings",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
