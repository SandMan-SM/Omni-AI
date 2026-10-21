import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/admin/interlinked",
  title: "Multi-Client Admin Control | Omni AI",
  description: "Internal multi-client admin control for the Interlinked surface — aggregate metrics across federation clients and per-client detail views.",
  noindex: true,
  imageTitle: "Multi-Client Admin Control",
  imageTopic: "Aggregate metrics across federation clients",
  imageEyebrow: "Omni AI · Internal",
});

export default function AdminInterlinkedLayout({ children }: { children: ReactNode }) {
  return children;
}
