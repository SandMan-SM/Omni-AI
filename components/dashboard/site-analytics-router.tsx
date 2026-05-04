"use client";

/**
 * Routes the agentic dashboard's "Site Analytics" tab to the right inner
 * component for the active workspace:
 *   - cps      → CpsAnalyticsPanel   (bespoke /api/dashboard/cps-data feed)
 *   - youngs   → InboundAnalyticsEmbed slug="youngs"
 *   - leifson  → InboundAnalyticsEmbed slug="leifson"
 *   - ltb      → InboundAnalyticsEmbed slug="ltb"
 *   - prime_iv → InboundAnalyticsEmbed slug="prime_iv"
 *
 * Reads the active workspace from localStorage and resolves it to a slug
 * via omni_businesses lookup (passed down by the AgiAdminPanel via props
 * so we don't double-fetch).
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CpsAnalyticsPanel = dynamic(
  () => import("@/components/dashboard/cps-analytics-panel"),
  { ssr: false, loading: () => <Skel /> },
);

const InboundAnalyticsEmbed = dynamic(
  () => import("@/components/dashboard/inbound-analytics-embed").then(m => m.InboundAnalyticsEmbed),
  { ssr: false, loading: () => <Skel /> },
);

function Skel() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-12 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500/40 border-t-emerald-500 animate-spin" />
    </div>
  );
}

export default function SiteAnalyticsRouter() {
  const [slug, setSlug] = useState<string | null>(null);
  // Bumped when the active business changes — re-runs the resolver effect
  // so switching workspace mid-session swaps the analytics panel without
  // a full reload. Without this, opening Site Analytics for one client
  // and then switching to another via /assets left the original panel.
  const [bizTick, setBizTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== "omni_active_business_id") return;
      setBizTick(n => n + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const bizId = window.localStorage.getItem("omni_active_business_id");
        if (!bizId || bizId === "all") {
          if (!cancelled) setSlug(null);
          return;
        }
        const { supabase } = await import("@/lib/agi-supabase");
        const { data } = await supabase
          .from("omni_businesses")
          .select("slug,name")
          .eq("id", bizId)
          .maybeSingle();
        if (cancelled) return;
        const resolved = (data?.slug ?? data?.name ?? "").toLowerCase();
        setSlug(resolved || null);
      } catch {
        if (!cancelled) setSlug(null);
      }
    })();
    return () => { cancelled = true; };
  }, [bizTick]);

  if (slug === "cps") return <CpsAnalyticsPanel />;
  if (slug === "youngs" || slug === "leifson" || slug === "ltb" || slug === "prime_iv") {
    return <InboundAnalyticsEmbed slug={slug as "youngs" | "leifson" | "ltb" | "prime_iv"} />;
  }
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-sm text-gray-400">
      Site Analytics is available for client workspaces (CPS, Youngs, Leifson, LTB, Prime IV). Switch workspace to view.
    </div>
  );
}
