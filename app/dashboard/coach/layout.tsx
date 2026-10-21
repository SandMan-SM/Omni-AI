import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/dashboard/coach",
  title: "AI Deal Coach | Omni AI Dashboard",
  description: "Deal coaching — AI recommendations on open opportunities, ranked by expected impact.",
  noindex: true,
  imageTitle: "AI Deal Coach",
  imageTopic: "Recommendations on open opportunities",
  imageEyebrow: "Omni AI · Dashboard",
});

export default function DashboardCoachLayout({ children }: { children: ReactNode }) {
  return children;
}
