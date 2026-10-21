import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/assets",
  title: "Agentic Assets | Omni AI",
  description: "Owner-only view of the agentic assets deployed across the Omni AI federation — sites, dashboards, newsletters, and integrations.",
  noindex: true,
  imageTitle: "Agentic Assets",
  imageTopic: "Owner-only federation asset surface",
  imageEyebrow: "Omni AI · Internal",
});

export default function AssetsLayout({ children }: { children: ReactNode }) {
  return children;
}
