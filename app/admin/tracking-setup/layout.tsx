import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/admin/tracking-setup",
  title: "Inbound Tracker Setup | Omni AI",
  description: "Internal setup surface for the Omni AI inbound tracker — install snippet, verification status, and site analytics wiring.",
  noindex: true,
  imageTitle: "Tracking Setup",
  imageTopic: "Install the inbound tracker",
  imageEyebrow: "Omni AI · Internal",
});

export default function AdminTrackingSetupLayout({ children }: { children: ReactNode }) {
  return children;
}
