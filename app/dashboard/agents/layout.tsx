import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/agents",
  title: "Client-Agent Fleet | Omni AI Dashboard",
  description: "The client-agent fleet — one agent layer per business, with the command surfaces and data each agent owns.",
  noindex: true,
  imageTitle: "Client-Agent Fleet",
  imageTopic: "Revenue command layer for every Omni AI client",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardAgentsLayout({ children }: { children: ReactNode }) {
  return children;
}
