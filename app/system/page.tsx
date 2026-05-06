// /system — describes the cross-portfolio sponsor + partner promotion
// system. Public page so Fred / Jaime / future sponsors can see exactly
// how lead-gen flows back to them. Doubles as internal documentation.

import type { Metadata } from "next";
import Link from "next/link";
import { SponsorBlock } from "@/components/sponsor/SponsorBlock";

export const metadata: Metadata = {
  title: "Portfolio Promotion System · Omni AI",
  description:
    "How every Omni AI portfolio site promotes Fred Circle (sponsor) and Live Better Podcast (partnership) — the embed, the analytics, the attribution.",
  openGraph: {
    title: "Portfolio Promotion System · Omni AI",
    description:
      "Fred Circle + Live Better Podcast embedded across every Omni AI portfolio site. One source of truth, attribution to omnileadsagi.com/dashboard.",
    url: "https://omnileadsagi.com/system",
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio Promotion System · Omni AI",
    description:
      "Fred Circle + Live Better Podcast embedded across every Omni AI portfolio site.",
  },
};

const PORTFOLIO_SITES = [
  { name: "Omni AI", slug: "omnileads", url: "https://omnileadsagi.com" },
  { name: "CPS · Psych & Custody Evaluations", slug: "cps", url: "https://psychandcustodyevaluations.com" },
  { name: "Leifson Built", slug: "leifson", url: "https://utahdeckandbasementremodel.com" },
  { name: "Youngs Cabinet Refinishing", slug: "youngs", url: "https://youngscabinetrefinishing.com" },
  { name: "Love Thy Barber", slug: "ltb", url: "https://lovethybarber.shop" },
  { name: "Alira", slug: "alira", url: "https://alira.live" },
  { name: "Phoenix Exteriors", slug: "phoenix", url: null },
  { name: "Nikki Fellows", slug: "niki", url: null },
  { name: "Live Better Podcast (Prime IV)", slug: "prime_iv", url: "https://livebetterpodcast.com" },
  { name: "Omni Leads", slug: "omnileads", url: "https://omnileads.shop" },
];

export default function SystemPage() {
  return (
    <main
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#fafafa",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "60px 24px 80px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#a1a1aa",
            fontSize: 13,
            textDecoration: "none",
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          ← omnileadsagi.com
        </Link>

        <div
          style={{
            color: "#f59e0b",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 16,
          }}
        >
          Portfolio Promotion System
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 800,
            margin: "10px 0 18px 0",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          One sponsor. One partner. Promoted on every site.
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "#d4d4d8",
            lineHeight: 1.65,
            maxWidth: 720,
            margin: "0 0 36px 0",
          }}
        >
          Every site in the Omni AI portfolio runs a single embedded block
          that promotes our sponsor (<strong>Fred Circle</strong>) as the
          primary slot and our partner (<strong>Live Better Podcast</strong>)
          as the secondary slot. One snippet, one source of truth, one
          analytics destination — every click, share, and subscribe pings
          back to{" "}
          <Link href="/dashboard" style={{ color: "#f59e0b" }}>
            omnileadsagi.com/dashboard
          </Link>{" "}
          so attribution is visible per portfolio site.
        </p>

        {/* Live demo of the actual block */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 40,
          }}
        >
          1 · Live demo
        </div>
        <p style={{ color: "#a1a1aa", fontSize: 14, margin: "8px 0 0 0" }}>
          This is the actual block as it renders on every portfolio site:
        </p>
        <SponsorBlock slug="omnileads" />

        {/* Architecture */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 50,
          }}
        >
          2 · How it works
        </div>
        <ol
          style={{
            color: "#d4d4d8",
            fontSize: 15,
            lineHeight: 1.85,
            paddingLeft: 24,
            margin: "12px 0 0 0",
          }}
        >
          <li>
            Each client site drops in a one-line script tag pointing at{" "}
            <code style={{ color: "#f59e0b" }}>
              omnileadsagi.com/embed/sponsor.js
            </code>
            .
          </li>
          <li>
            The embed renders Fred&apos;s card (primary, biggest CTA),
            Live Better Podcast (secondary, partnership badge), share
            controls on each, and an email-capture form.
          </li>
          <li>
            UTM-tagged outbound links —{" "}
            <code style={{ color: "#f59e0b" }}>
              utm_source=omni-&lt;slug&gt;
            </code>{" "}
            — let Fred and Jaime see attribution in their own analytics
            without us having to share dashboards.
          </li>
          <li>
            Every impression / click / share / subscribe pings{" "}
            <code style={{ color: "#f59e0b" }}>
              /api/inbound/&lt;slug&gt;/events
            </code>{" "}
            on omnileadsagi.com. The per-tenant agentic dashboard sees the
            attribution row by row.
          </li>
          <li>
            Copy or sponsor changes once, propagates everywhere — no
            client-repo edits required.
          </li>
        </ol>

        {/* Portfolio coverage */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 50,
          }}
        >
          3 · Portfolio sites covered
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
            margin: "16px 0 0 0",
          }}
        >
          {PORTFOLIO_SITES.map((s) => (
            <div
              key={`${s.slug}-${s.name}`}
              style={{
                background: "#1a1a1a",
                border: "1px solid #27272a",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fafafa",
                  marginBottom: 4,
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#a1a1aa",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#f59e0b", textDecoration: "none" }}
                  >
                    {s.url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span style={{ color: "#52525b" }}>domain pending</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#52525b",
                  marginTop: 6,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                slug: {s.slug}
              </div>
            </div>
          ))}
        </div>

        {/* Drop-in snippet */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 50,
          }}
        >
          4 · The drop-in snippet
        </div>
        <p style={{ color: "#a1a1aa", fontSize: 14, margin: "8px 0 12px 0" }}>
          Paste these two lines into any portfolio site. Replace{" "}
          <code style={{ color: "#f59e0b" }}>cps</code> with the site&apos;s
          slug from the table above:
        </p>
        <pre
          style={{
            background: "#1a1a1a",
            border: "1px solid #27272a",
            borderRadius: 10,
            padding: "16px 18px",
            color: "#e4e4e7",
            fontSize: 13,
            lineHeight: 1.7,
            overflowX: "auto",
            margin: 0,
          }}
        >
          {`<div id="omni-sponsor" data-slug="cps"></div>
<script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>`}
        </pre>

        {/* Sponsor / partner descriptions */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: 50,
          }}
        >
          5 · Who&apos;s being promoted
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
            margin: "16px 0 0 0",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg,#1a1a1a 0%,#1f1410 100%)",
              border: "1px solid #f59e0b66",
              borderRadius: 12,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                color: "#f59e0b",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Sponsor — primary slot
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fafafa",
                marginBottom: 6,
              }}
            >
              Fred Circle
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#d4d4d8",
                lineHeight: 1.65,
              }}
            >
              Pays for the dispatch. Gets the headline placement, biggest
              CTA, and dedicated share controls on every Omni AI portfolio
              site. The link goes straight to his Circle.rn host event.
            </div>
          </div>

          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #27272a",
              borderRadius: 12,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#a1a1aa",
                marginBottom: 4,
              }}
            >
              In partnership with omnileadsagi.com
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#fafafa",
                marginBottom: 4,
              }}
            >
              Live Better Podcast
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#d4d4d8",
                lineHeight: 1.65,
              }}
            >
              Show + community from our partner Jaime (Prime IV). The
              partnership is the marketing point — the &ldquo;in partnership
              with&rdquo; badge on the secondary slot is what ties their
              audience back to the Omni AI portfolio.
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 60,
            paddingTop: 24,
            borderTop: "1px solid #27272a",
            color: "#71717a",
            fontSize: 12,
            lineHeight: 1.65,
          }}
        >
          Want to sponsor or partner? Email{" "}
          <a
            href="mailto:alfred@omnileadsagi.com"
            style={{ color: "#f59e0b" }}
          >
            alfred@omnileadsagi.com
          </a>{" "}
          — one slot rotates per quarter, attribution is visible to both
          sides, and the embed deploys the same day.
        </div>
      </div>
    </main>
  );
}
