import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/autopilot",
  title: "Autopilot | Omni AI Dashboard",
  description: "Autopilot configuration and run state — the hands-off mode where the agent layer works a queue without supervision.",
  noindex: true,
  imageTitle: "Autopilot",
  imageTopic: "Hands-off agent operation",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardAutopilotLayout({ children }: { children: ReactNode }) {
  return children;
}
