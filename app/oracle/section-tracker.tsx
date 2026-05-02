"use client";

import { useEffect } from "react";

const SECTIONS = [
  "oracle-1-cold-open",
  "oracle-2-what",
  "oracle-3-realms",
  "oracle-4-pantheon",
  "oracle-5-hades",
  "oracle-6-arena",
  "oracle-7-projects",
  "oracle-8-asi",
  "oracle-9-dominate",
  "oracle-10-roadmap",
  "oracle-11-cta",
] as const;

const TIME_BINS_MS = [15_000, 30_000, 60_000, 180_000, 600_000];

function fire(payload: Record<string, unknown>) {
  try {
    const url = "/api/events/track";
    const body = JSON.stringify({
      event_type: "engagement",
      event_category: "oracle",
      action: "view",
      ...payload,
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

export function OracleSectionTracker() {
  useEffect(() => {
    // Section-in-view: fire once per section per session
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          if (seen.has(id)) continue;
          seen.add(id);
          fire({ target_id: id, target_type: "oracle-section" });
        }
      },
      { threshold: 0.5 }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Time-on-page bins
    const timers: number[] = [];
    TIME_BINS_MS.forEach((ms) => {
      const t = window.setTimeout(() => {
        fire({
          target_id: `dwell-${Math.floor(ms / 1000)}s`,
          target_type: "oracle-dwell",
          duration_ms: ms,
        });
      }, ms);
      timers.push(t);
    });

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
