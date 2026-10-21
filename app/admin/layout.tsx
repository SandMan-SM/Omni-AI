import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

// Admin control panel — authenticated internal surface. Noindex,
// nofollow, with the matching disallow in app/robots.ts.
//
// The OG/Twitter card is intentional even on a noindex page: admin
// surface URLs get pasted into operator channels, and a card keeps the
// pasted link readable instead of showing a bare hostname.
export const metadata: Metadata = buildMetadata({
  path: "/admin",
  title: "Admin — Omni AI Dashboard",
  description:
    "Omni AI admin control panel. Manage users, campaigns, newsletter, and system operations.",
  noindex: true,
  imageTitle: "Admin Control Panel",
  imageTopic: "Manage clients, campaigns, and system operations",
  imageEyebrow: "Omni AI · Internal",
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
