import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

// Synthetic Intelligence Command Center — authenticated internal
// surface. Noindex/nofollow; the matching disallow lives in
// app/robots.ts. Per-client views under /command/client/[slug] carry
// their own layout and title.
export const metadata: Metadata = buildMetadata({
  path: "/command",
  title: "$MAFI Command Center — Omni AI",
  description:
    "Synthetic Intelligence Command Center. Live agent control, deployment tracking, visual error detection.",
  noindex: true,
  imageTitle: "Command Center",
  imageTopic: "Live agent control and deployment tracking",
  imageEyebrow: "Omni AI · Internal",
});

export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
