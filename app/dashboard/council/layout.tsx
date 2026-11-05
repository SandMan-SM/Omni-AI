import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

// The Council Codex view is a client component (it fetches an admin-gated
// API with the omni_token bearer), and a client component cannot export
// `metadata` — so the metadata lives in this sibling layout, exactly as
// `/dashboard/analytics` does it.

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/council",
  title: "Council Codex · Omni AI",
  description: "Active operator directives + latest training thread.",
  noindex: true,
  imageTitle: "Council Codex",
  imageTopic: "Active operator directives and training thread",
  imageEyebrow: "Omni AI · Internal",
});

export default function DashboardCouncilLayout({ children }: { children: ReactNode }) {
  return children;
}
