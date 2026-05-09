"use client";

// SponsorBlock — the canonical sponsor + partner feature block that
// every Omni AI portfolio site renders in its newsletter footer + at
// the top of /newsletter (the post-publish landing) + in the email
// payload.
//
// Two slots, in this order:
//   1. Fred (Circle.rn) — PRIMARY. He's our paying sponsor; lead-gen
//      attribution must surface his link first, biggest, with the
//      strongest CTA.
//   2. Live Better Podcast — SECONDARY. Partnership with omnileadsagi.com
//      (Prime IV channel). The "in partnership with" badge is
//      non-optional — the partnership is the marketing point.
//
// Every interactive element pings back to omnileadsagi.com so the
// originating tenant's agentic dashboard
// (omnileadsagi.com/dashboard) shows real attribution. Each tenant
// passes its own `slug` so the inbound_<slug>_events table receives
// the row.

import { useCallback, useEffect } from "react";
import { ShareControls } from "@/components/sponsor/ShareControls";

interface SponsorBlockProps {
  /** Per-tenant slug — used as the inbound_<slug>_events partition key. */
  slug: string;
  /** Optional: light theme override. Default is dark to match every Omni
   * portfolio site's chrome. */
  theme?: "dark" | "light";
}

const FRED_LINK = "https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc";
const LBP_LINK = "https://livebetterpodcast.com";
const CPS_LINK = "https://psychandcustodyevaluations.com";

// Where the embed pings analytics. Always the central dashboard so the
// operator sees ALL tenants' sponsor traffic in one place.
const ANALYTICS_HOST = "https://omnileadsagi.com";

type Target = "fred" | "lbp" | "cps";

function ping(slug: string, target: Target, action: "view" | "click" | "share", extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // Fire-and-forget — never block the click. keepalive lets the beacon
  // survive even when the user is navigating away to the sponsor URL.
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "sponsor_" + action,
        event_category: "sponsor",
        action,
        target_id: target,
        target_type: "sponsor_card",
        page_url: window.location.href,
        properties: { sponsor: target, ...extra },
      }),
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

function trackedHref(target: Target, slug: string): string {
  const base =
    target === "fred" ? FRED_LINK :
    target === "lbp" ? LBP_LINK :
    CPS_LINK;
  // UTM tagging so each partner (Fred / podcast / CPS) can see attribution in their own
  // analytics. utm_source = the tenant slug → they know which Omni
  // portfolio site sent the click.
  const u = new URL(base);
  u.searchParams.set("utm_source", `omni-${slug}`);
  u.searchParams.set("utm_medium", "newsletter");
  u.searchParams.set(
    "utm_campaign",
    target === "fred" ? "fred-circle" :
    target === "lbp" ? "live-better-podcast" :
    "cps-feature",
  );
  return u.toString();
}

export function SponsorBlock({ slug, theme = "dark" }: SponsorBlockProps) {
  // View ping fires once per mount — counts as "block was seen", which
  // matters for sponsor reporting (impressions, not just clicks).
  useEffect(() => {
    ping(slug, "fred", "view");
    ping(slug, "lbp", "view");
    ping(slug, "cps", "view");
  }, [slug]);

  const onClick = useCallback(
    (target: Target) => {
      ping(slug, target, "click");
    },
    [slug],
  );

  const isDark = theme === "dark";
  const surface = isDark ? "#0f0f0f" : "#fafafa";
  const card = isDark ? "#1a1a1a" : "#ffffff";
  const border = isDark ? "#27272a" : "#e4e4e7";
  const textPrimary = isDark ? "#fafafa" : "#0a0a0a";
  const textMuted = isDark ? "#a1a1aa" : "#52525b";
  const accent = "#f59e0b"; // amber — matches Omni AI brand

  return (
    <section
      className="omni-sponsor-block"
      style={{
        background: surface,
        borderRadius: 16,
        padding: "28px 24px",
        margin: "32px 0",
        border: `1px solid ${border}`,
      }}
      aria-labelledby={`sponsor-block-${slug}`}
    >
      {/* Mobile rules — narrow phones (≤520px) need: tighter inner
          padding, smaller card font sizes, and the right-side CTA
          allowed to drop BELOW the text. Without these, the
          description gets squeezed under the "Open →" pill and the
          card overflows the gutter. Inline <style> keeps everything
          colocated with the component. */}
      <style>{`
        @media (max-width: 520px) {
          .omni-sponsor-block { padding: 20px 16px !important; }
          .omni-sponsor-block .osb-card { padding: 18px 18px !important; }
          .osb-card-row { flex-wrap: wrap !important; gap: 12px !important; }
          .osb-card-cta { align-self: flex-start !important; }
          .osb-fred-title { font-size: 17px !important; line-height: 1.3 !important; }
          .osb-card-desc { font-size: 13px !important; }
          .omni-sponsor-block .osb-share-row { gap: 6px !important; }
          .omni-sponsor-block .osb-share-row button {
            font-size: 11px !important;
            padding: 5px 10px !important;
          }
        }
      `}</style>
      <h2
        id={`sponsor-block-${slug}`}
        style={{
          color: textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          margin: "0 0 18px 0",
        }}
      >
        Featured · Sponsored by Fred
      </h2>

      {/* PRIMARY — Fred (sponsor) */}
      <a
        href={trackedHref("fred", slug)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClick("fred")}
        className="osb-card"
        style={{
          display: "block",
          background: `linear-gradient(135deg, ${card} 0%, #1f1410 100%)`,
          border: `1px solid ${accent}66`,
          borderRadius: 14,
          padding: "22px 24px",
          textDecoration: "none",
          color: textPrimary,
          marginBottom: 16,
          transition: "transform 0.15s, border-color 0.15s",
        }}
      >
        <div className="osb-card-row" style={{ display: "flex", alignItems: "flex-start", gap: 16, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: accent,
                marginBottom: 6,
              }}
            >
              Sponsor
            </div>
            <div className="osb-fred-title" style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
              Fred — Live with the Host
            </div>
            <div className="osb-card-desc" style={{ fontSize: 14, color: textMuted, lineHeight: 1.55 }}>
              Tap in to Fred&apos;s live host event. Sponsor of this
              dispatch — the click goes straight to him.
            </div>
          </div>
          <span
            className="osb-card-cta"
            style={{
              flexShrink: 0,
              background: accent,
              color: "#0a0a0a",
              padding: "10px 16px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Open →
          </span>
        </div>
      </a>

      {/* Share controls for the Fred card. Sponsor-share gets its own
          row so analytics can split sponsor-share from partner-share. */}
      <ShareControls
        url={trackedHref("fred", slug)}
        title="Live with Fred — sponsored dispatch from Omni AI"
        slug={slug}
        target="fred"
        align="left"
      />

      {/* SECONDARY — Live Better Podcast (partnership) */}
      <a
        href={trackedHref("lbp", slug)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClick("lbp")}
        className="osb-card"
        style={{
          display: "block",
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: "16px 20px",
          textDecoration: "none",
          color: textPrimary,
          marginTop: 22,
        }}
      >
        <div className="osb-card-row" style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: textMuted,
                marginBottom: 4,
              }}
            >
              In partnership with omnileadsagi.com
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
              Live Better Podcast
            </div>
            <div className="osb-card-desc" style={{ fontSize: 13, color: textMuted }}>
              Show + community from our podcast partner — listen, subscribe, share.
            </div>
          </div>
          <span className="osb-card-cta" style={{ flexShrink: 0, fontSize: 12, color: accent, fontWeight: 600 }}>
            Listen →
          </span>
        </div>
      </a>

      <ShareControls
        url={trackedHref("lbp", slug)}
        title="Live Better Podcast — in partnership with Omni AI"
        slug={slug}
        target="lbp"
        align="left"
      />

      {/* TERTIARY — CPS · Featured Client. The third tier in the slot
          hierarchy: paid sponsor → strategic partnership → featured
          client. CPS is one of our flagship operators (forensic
          psych + custody evaluations) and gets cross-portfolio
          promotion as part of the agency relationship. Visually
          subdued vs. Fred's card so it never competes with the
          paying sponsor for attention. */}
      <a
        href={trackedHref("cps", slug)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClick("cps")}
        className="osb-card"
        style={{
          display: "block",
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: "16px 20px",
          textDecoration: "none",
          color: textPrimary,
          marginTop: 16,
        }}
      >
        <div className="osb-card-row" style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: textMuted,
                marginBottom: 4,
              }}
            >
              Featured client · powered by Omni AI
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
              CPS · Psych &amp; Custody Evaluations
            </div>
            <div className="osb-card-desc" style={{ fontSize: 13, color: textMuted }}>
              Forensic psychology + custody evaluations across Utah.
              Trusted by attorneys, courts, and families.
            </div>
          </div>
          <span className="osb-card-cta" style={{ flexShrink: 0, fontSize: 12, color: accent, fontWeight: 600 }}>
            Learn more →
          </span>
        </div>
      </a>

      <ShareControls
        url={trackedHref("cps", slug)}
        title="CPS · Psych & Custody Evaluations — featured client of Omni AI"
        slug={slug}
        target="cps"
        align="left"
      />
    </section>
  );
}
