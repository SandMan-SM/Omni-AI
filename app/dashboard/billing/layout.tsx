import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/billing",
  title: "Billing | Omni AI Dashboard",
  description: "Billing and plan management for Omni AI accounts — current tier, upgrade path, and Stripe configuration.",
  noindex: true,
  imageTitle: "Billing",
  imageTopic: "Plan management and upgrades",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardBillingLayout({ children }: { children: ReactNode }) {
  return children;
}
