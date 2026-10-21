import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/sponsor",
  title: "Sponsor | Omni AI Dashboard",
  description: "Sponsor performance — sponsored-business deal values, contact detail, and attribution.",
  noindex: true,
  imageTitle: "Sponsor",
  imageTopic: "Sponsored-business attribution",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardSponsorLayout({ children }: { children: ReactNode }) {
  return children;
}
