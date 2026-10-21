import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/inbox",
  title: "Inbox | Omni AI Dashboard",
  description: "Federation inbox — agent replies, inbound conversations, and manual reply logging.",
  noindex: true,
  imageTitle: "Inbox",
  imageTopic: "Agent replies and inbound conversations",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardInboxLayout({ children }: { children: ReactNode }) {
  return children;
}
