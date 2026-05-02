"use client";

/**
 * Thin wrapper around the existing InboundAnalytics component for embedding
 * inside the agentic dashboard's Site Analytics tab. Forces a slug, hides
 * the brand picker (clients only see their own data), and applies the
 * dashboard's bg/border treatment so it sits cleanly inside the panel.
 */

import dynamic from "next/dynamic";
import type { InboundSlug } from "@/lib/inbound-types";

const InboundAnalytics = dynamic(
  () => import("@/app/dashboard/analytics/InboundAnalytics"),
  { ssr: false, loading: () => <Skel /> },
);

function Skel() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-12 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500/40 border-t-emerald-500 animate-spin" />
    </div>
  );
}

export function InboundAnalyticsEmbed({ slug }: { slug: InboundSlug }) {
  return (
    <div className="space-y-4">
      <InboundAnalytics defaultSlug={slug} />
    </div>
  );
}

export default InboundAnalyticsEmbed;
