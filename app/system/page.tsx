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

// Every portfolio site gets two URLs: the production domain (if attached)
// and the live Vercel preview hostname. Even sites without a production
// domain are reachable for preview / QA via the vercel.app URL — that's
// the "in development" signal we surface to readers.
type PortfolioSite = {
  name: string;
  slug: string;
  /** Live production domain (or omitted if domain not yet attached). */
  url?: string;
  /** Always-on Vercel preview URL — reachable even before the domain
   *  attaches so the site can be QA'd in flight. */
  preview: string;
  /** Short editorial line for the card. */
  blurb?: string;
  /** Status pill — "live" | "wip" | "soon". */
  status: "live" | "wip" | "soon";
  /** Tag for grid grouping. */
  group:
    | "core"
    | "client-site"
    | "newsroom"
    | "partnership"
    | "marketing-property";
};

const PORTFOLIO_SITES: PortfolioSite[] = [
  {
    name: "Omni AI",
    slug: "omnileads",
    url: "https://omnileadsagi.com",
    preview: "https://omni-ai-sandman-sms-projects.vercel.app",
    blurb: "The control tower. Lead-gen for the entire portfolio.",
    status: "live",
    group: "core",
  },
  {
    name: "CPS · Psych & Custody Evaluations",
    slug: "cps",
    url: "https://psychandcustodyevaluations.com",
    preview: "https://cps-website-nine.vercel.app",
    blurb: "Forensic psychology + custody evaluations.",
    status: "live",
    group: "client-site",
  },
  {
    name: "Leifson Built",
    slug: "leifson",
    url: "https://utahdeckandbasementremodel.com",
    preview: "https://leifson-built.vercel.app",
    blurb: "Custom-build contractor. Itemized estimates, no surprises.",
    status: "live",
    group: "client-site",
  },
  {
    name: "Youngs Cabinet Refinishing",
    slug: "youngs",
    url: "https://youngscabinetrefinishing.com",
    preview: "https://youngs-cabinets.vercel.app",
    blurb: "Refinish instead of replace — 60-day waitlist.",
    status: "live",
    group: "client-site",
  },
  {
    name: "Love Thy Barber",
    slug: "ltb",
    url: "https://lovethybarber.shop",
    preview: "https://love-thy-barber.vercel.app",
    blurb: "Premium men's grooming. Hot-towel shaves and classic cuts.",
    status: "live",
    group: "client-site",
  },
  {
    name: "Alira",
    slug: "alira",
    url: "https://alira.live",
    preview: "https://alira-site.vercel.app",
    blurb: "Concierge home care for Utah families.",
    status: "live",
    group: "client-site",
  },
  {
    name: "Phoenix Exteriors",
    slug: "phoenix",
    preview: "https://phoenix-exteriors-site.vercel.app",
    blurb: "Roofing + exteriors. Domain pending — preview only.",
    status: "wip",
    group: "client-site",
  },
  {
    name: "Nikki Fellows",
    slug: "niki",
    preview: "https://nikki-fellows-site.vercel.app",
    blurb: "Personal brand + coaching. Domain pending — preview only.",
    status: "wip",
    group: "client-site",
  },
  {
    name: "Live Better Podcast",
    slug: "prime_iv",
    url: "https://livebetterpodcast.com",
    preview: "https://on-the-drip-deploy.vercel.app",
    blurb:
      "Show + community in partnership with Omni AI. Hosted by Jaime (Prime IV).",
    status: "live",
    group: "partnership",
  },
  {
    name: "Omni Leads",
    slug: "omnileads",
    url: "https://omnileads.shop",
    preview: "https://omni-leads.vercel.app",
    blurb: "Marketing + offer property for Omni AI's services.",
    status: "live",
    group: "marketing-property",
  },
  {
    name: "Utah Main Street",
    slug: "mainst",
    preview: "https://utah-main-street.vercel.app",
    blurb:
      "Weekly broadsheet covering Utah's best operators. Domain (utahmainstreet.com) pending.",
    status: "soon",
    group: "newsroom",
  },
  {
    name: "Beehive Biz Pulse",
    slug: "beehive",
    preview: "https://beehive-biz-pulse.vercel.app",
    blurb:
      "Daily business ticker for Utah — hiring, raising, opening, winning. Domain (beehivebizpulse.com) pending.",
    status: "soon",
    group: "newsroom",
  },
  {
    name: "The Wasatch Post",
    slug: "wasatch",
    preview: "https://the-wasatch-post.vercel.app",
    blurb:
      "Long-form business journalism from the front range. Domain (thewasatchpost.com) pending.",
    status: "soon",
    group: "newsroom",
  },
];

// Status pill styling table — single source of truth so the grid card
// and any future filter chip stay aligned visually.
const STATUS_STYLE: Record<
  PortfolioSite["status"],
  { label: string; bg: string; fg: string }
> = {
  live: { label: "Live", bg: "#10b981", fg: "#022c22" },
  wip: { label: "In dev", bg: "#f59e0b", fg: "#1c1917" },
  soon: { label: "Coming soon", bg: "#a855f7", fg: "#1e0a35" },
};

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

        {/* How we're different — positioning the system explicitly so
            sponsors / partners / prospects understand WHY this is novel
            before they see the mechanics. Keeps the tone confident
            without inflated language; concrete claims, no fluff. */}
        <section
          style={{
            background:
              "linear-gradient(135deg,#111111 0%,#0d1117 60%,#1a0f1f 100%)",
            border: "1px solid #27272a",
            borderRadius: 16,
            padding: "30px 28px",
            margin: "44px 0 12px 0",
          }}
        >
          <div
            style={{
              color: "#f59e0b",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            How we&apos;re different
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              margin: "0 0 12px 0",
              color: "#fafafa",
            }}
          >
            Most agencies sell ads. We run a portfolio that promotes our
            sponsors as editorial.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "#d4d4d8",
              lineHeight: 1.7,
              margin: "0 0 20px 0",
              maxWidth: 720,
            }}
          >
            A standard agency takes a fee, runs a campaign, hands over a
            deck. The campaign ends, the audience disperses, the operator
            starts over the next quarter. Omni AI flipped the model:
            we own a network of high-trust local sites — newsrooms,
            client storefronts, partner shows — and we feature one
            sponsor across <em>every single one</em>, simultaneously, for
            as long as they sponsor. That&apos;s the unfair advantage.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 8,
            }}
          >
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                One sponsor · every site
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                A sponsor pays once and shows up on every property in the
                network at the same time. No retargeting buys, no
                fragmented campaigns — single placement, compounding
                impressions.
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Editorial-grade trust
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                Our newsrooms (Utah Main Street, Beehive Biz Pulse, The
                Wasatch Post) cover real operators with real receipts.
                Sponsors ride that signal — readers click because the
                publication earned the trust, not because the ad was loud.
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Attribution that doesn&apos;t lie
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                Every click, share, and email subscribe pings back to{" "}
                <Link href="/dashboard" style={{ color: "#f59e0b" }}>
                  /dashboard
                </Link>
                . Sponsors see exactly which property drove the click; we
                see which audiences are converting; the operator sees lead
                quality in real time. No black-box attribution.
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Built like infrastructure
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                Single source of truth at omnileadsagi.com pushes copy
                changes to every site in seconds. No client-by-client
                edits, no stale placements, no missed updates when a
                sponsor rotates.
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Sponsor and partner, not just sponsor
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                One paid sponsor at a time + one partnership slot
                (currently Live Better Podcast) so the audience never sees
                two competitors fighting for attention. Editorial discipline
                = better conversion for everyone in the rotation.
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "#10b981",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Operators, not order-takers
              </div>
              <div style={{ fontSize: 13.5, color: "#e4e4e7", lineHeight: 1.6 }}>
                We run our own businesses inside this network — services,
                newsrooms, software. Every sponsor placement is tested on
                our own pipeline first. If it doesn&apos;t convert for us,
                it doesn&apos;t go to a sponsor.
              </div>
            </div>
          </div>
        </section>

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
        <p style={{ color: "#a1a1aa", fontSize: 14, margin: "8px 0 0 0", lineHeight: 1.65 }}>
          Every property is reachable here — green pill = production domain
          live, amber = in development, purple = scaffolded and previewing.
          Click <strong>Visit</strong> for the production URL when one
          exists, or <strong>Preview</strong> for the live Vercel build.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
            margin: "18px 0 0 0",
          }}
        >
          {PORTFOLIO_SITES.map((s) => {
            const status = STATUS_STYLE[s.status];
            return (
            <div
              key={`${s.slug}-${s.name}`}
              style={{
                background: "#111111",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fafafa",
                    lineHeight: 1.3,
                    flex: 1,
                  }}
                >
                  {s.name}
                </div>
                <span
                  style={{
                    background: status.bg,
                    color: status.fg,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {status.label}
                </span>
              </div>

              {s.blurb && (
                <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.55 }}>
                  {s.blurb}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: "1 1 auto",
                      textAlign: "center",
                      background: "#f59e0b",
                      color: "#1c1917",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "7px 12px",
                      borderRadius: 6,
                      textDecoration: "none",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Visit live →
                  </a>
                )}
                <a
                  href={s.preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: "1 1 auto",
                    textAlign: "center",
                    background: "transparent",
                    border: "1px solid #3f3f46",
                    color: "#d4d4d8",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "7px 12px",
                    borderRadius: 6,
                    textDecoration: "none",
                    letterSpacing: "0.04em",
                  }}
                >
                  Preview build →
                </a>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 10,
                  color: "#52525b",
                  marginTop: 4,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                <span>slug · {s.slug}</span>
                {s.url && (
                  <span style={{ color: "#71717a" }}>
                    {s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                )}
              </div>
            </div>
            );
          })}
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
