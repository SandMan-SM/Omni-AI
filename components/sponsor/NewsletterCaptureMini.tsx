"use client";

// NewsletterCaptureMini — single-field email capture that posts to
// the central inbound_<slug>_newsletter-event endpoint at
// omnileadsagi.com. One subscribe pipe across every Omni portfolio
// site so the operator's main newsletter list grows uniformly and the
// per-tenant dashboard sees the conversion attribution.
//
// Designed to slot under SponsorBlock at the bottom of a newsletter
// post or beside the hero on a landing page. No styling tokens — pure
// inline so it drops into ANY client site (Tailwind, vanilla, custom).

import { useState } from "react";

interface Props {
  slug: string;
  /** Headline shown above the field. Override per site if needed. */
  headline?: string;
  /** Sub-copy below the field. Same. */
  subhead?: string;
  /** Where the operator will send the eventual post — for confirmation copy. */
  brand?: string;
}

const ANALYTICS_HOST = "https://omnileadsagi.com";

export function NewsletterCaptureMini({
  slug,
  headline = "Get the dispatch",
  subhead = "One short post a day. Sponsor + partner picks. Unsubscribe anytime.",
  brand = "Omni AI",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/.+@.+\..+/.test(email)) {
      setStatus("err");
      setErrMsg("Enter a valid email");
      return;
    }
    setStatus("sending");
    setErrMsg(null);
    try {
      // Subscribes flow into inbound_<slug>_leads with source flag —
      // not the newsletter_events table (that's for opens / clicks /
      // unsubs only). The lead_source distinguishes this from a
      // contact-form lead so the operator can filter the dashboard.
      const res = await fetch(`${ANALYTICS_HOST}/api/inbound/${slug}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: "newsletter_subscribe",
          page_path: typeof window !== "undefined" ? window.location.pathname : null,
          utm_source: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_source") : null,
          utm_medium: "sponsor_block",
          utm_campaign: brand.toLowerCase().replace(/\s+/g, "-"),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setStatus("ok");
      setEmail("");
    } catch (e2) {
      setStatus("err");
      setErrMsg(e2 instanceof Error ? e2.message : "Subscribe failed");
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "#111111",
        border: "1px solid #27272a",
        borderRadius: 14,
        padding: "20px 22px",
        margin: "20px 0",
      }}
      aria-labelledby={`newsletter-${slug}`}
    >
      <div
        id={`newsletter-${slug}`}
        style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", marginBottom: 4 }}
      >
        {headline}
      </div>
      <div style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 14 }}>{subhead}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email"
          style={{
            flex: "1 1 220px",
            background: "#1a1a1a",
            border: "1px solid #3f3f46",
            color: "#fafafa",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "ok"}
          style={{
            background: status === "ok" ? "#10b981" : "#f59e0b",
            color: "#0a0a0a",
            border: "none",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: status === "sending" ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {status === "sending" ? "Subscribing…" : status === "ok" ? "✓ Subscribed" : "Subscribe"}
        </button>
      </div>

      {status === "err" && errMsg && (
        <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{errMsg}</div>
      )}
      {status === "ok" && (
        <div style={{ color: "#10b981", fontSize: 12, marginTop: 8 }}>
          You&apos;re in. Watch your inbox for the next dispatch from {brand}.
        </div>
      )}
    </form>
  );
}
