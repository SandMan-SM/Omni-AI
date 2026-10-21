import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/meetings",
  title: "Meetings | Omni AI Dashboard",
  description: "Booked meetings across federation businesses, with notes and next steps attached to each slot.",
  noindex: true,
  imageTitle: "Meetings",
  imageTopic: "Booked meetings and notes",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardMeetingsLayout({ children }: { children: ReactNode }) {
  return children;
}
