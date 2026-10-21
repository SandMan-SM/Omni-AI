import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/admin/info",
  title: "Admin Debrief | Omni AI",
  description: "Internal operator debrief on how the Omni AI system works end to end — ingestion, agent layers, federation surfaces, and escalation paths.",
  noindex: true,
  imageTitle: "Admin Debrief",
  imageTopic: "How Omni AI Works",
  imageEyebrow: "Omni AI · Internal",
});

export default function AdminInfoLayout({ children }: { children: ReactNode }) {
  return children;
}
