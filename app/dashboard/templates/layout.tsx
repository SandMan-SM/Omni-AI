import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/templates",
  title: "Sequence Templates | Omni AI Dashboard",
  description: "Pre-built outreach playbooks — reusable email and SMS sequences ready to deploy against a lead list.",
  noindex: true,
  imageTitle: "Sequence Templates",
  imageTopic: "Pre-built playbooks",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardTemplatesLayout({ children }: { children: ReactNode }) {
  return children;
}
