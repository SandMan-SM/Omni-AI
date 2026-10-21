import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

// The dashboard root layout carries the metadata for /dashboard itself.
// Every child route (/dashboard/leads, /dashboard/analytics, …) has its
// own layout with a per-tab title and canonical, so an operator with
// a dozen dashboard tabs open sees a distinct title in each one instead
// of a dozen copies of "Dashboard".
//
// This route is an authenticated internal surface — noindex, nofollow,
// with a matching disallow in app/robots.ts. The OpenGraph/Twitter card
// is still intentional: dashboard links get pasted into internal
// channels, and an untitled link renders as a bare URL card instead of
// a readable "Omni AI · Dashboard" card.
export const metadata: Metadata = buildMetadata({
  path: "/dashboard",
  title: "Dashboard — Your AI Command Center | Omni AI",
  description:
    "Omni AI operator dashboard. Track campaigns, review agent performance, and manage client accounts.",
  noindex: true,
  imageTitle: "Dashboard",
  imageTopic: "Your AI command center",
  imageEyebrow: "Omni AI · Internal",
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
