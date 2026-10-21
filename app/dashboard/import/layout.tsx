import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/import",
  title: "Import Leads | Omni AI Dashboard",
  description: "Import leads into the federation — paste a CSV or upload a file, then map and deduplicate records.",
  noindex: true,
  imageTitle: "Import Leads",
  imageTopic: "CSV and file lead import",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardImportLayout({ children }: { children: ReactNode }) {
  return children;
}
