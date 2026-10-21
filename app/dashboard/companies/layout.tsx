import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/companies",
  title: "Company Intel | Omni AI Dashboard",
  description: "Company intelligence across the federation — headcount by department and keyword signals per business.",
  noindex: true,
  imageTitle: "Company Intel",
  imageTopic: "Headcount and keyword signals",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardCompaniesLayout({ children }: { children: ReactNode }) {
  return children;
}
