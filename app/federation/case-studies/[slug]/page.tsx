// /federation/case-studies/[slug] — federation case study.
// Data lives in lib/case-studies.ts. Live metrics fetched per request
// from Supabase by inboundSlug. Cosmic background + dual share rows.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import CaseCosmicBackground from "@/components/case-study/CaseCosmicBackground";
import CaseStudyGate from "@/components/case-study/CaseStudyGate";
import ShareRow from "@/components/case-study/ShareRow";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = "https://omnileadsagi.com";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) return { title: "Case study not found" };
  const title = `${c.brand} — Build & Pricing Case Study · Omni AI`;
  const desc = c.tagline;
  const url = `${SITE_URL}/federation/case-studies/${c.slug}`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      type: "article",
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [`${url}/opengraph-image`],
    },
    robots: { index: true, follow: true },
  };
}

const TIERS = [
  { name: "Template", range: "$1.5k – $3.5k", desc: "Squarespace / Wix / Webflow stock theme. No custom code.", fits: "Hobbyists, side projects.", accent: "rgba(160,123,255,0.18)", fg: "#a07bff", key: "template" },
  { name: "Themed CMS", range: "$5k – $12k", desc: "WordPress or Shopify with theme customization, basic plugins.", fits: "Local services, e-commerce starters.", accent: "rgba(88,200,255,0.16)", fg: "#58c8ff", key: "themed" },
  { name: "Bespoke Next.js", range: "$18k – $25k", desc: "Custom codebase, custom design system, JSON-LD schema, analytics pipeline.", fits: "Operators, artists, founders, mastermind hosts.", accent: "rgba(251,191,36,0.18)", fg: "#fbbf24", key: "bespoke" },
  { name: "Federation member", range: "$30k – $80k+", desc: "Above + federation distribution + AI CEO layer + retained operation.", fits: "Long-term partners with revenue at stake.", accent: "rgba(45,220,168,0.18)", fg: "#2ddca8", key: "federation" },
];

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: "rgba(45,220,168,0.16)", fg: "#2ddca8", label: "LIVE" },
  in_progress: { bg: "rgba(88,200,255,0.16)", fg: "#58c8ff", label: "IN PROGRESS" },
  scaffold: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "SCAFFOLD" },
  forthcoming: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "FORTHCOMING" },
  archived: { bg: "rgba(115,115,115,0.16)", fg: "#a3a3a3", label: "ARCHIVED" },
};

type LiveMetrics = {
  events_30d: number | null;
  leads_30d: number | null;
  referrals_in_30d: number | null;
  referrals_out_30d: number | null;
  pantheon_elo: number | null;
  pantheon_tier: string | null;
};

async function fetchMetrics(inboundSlug: string | null, pantheonCEO: string | null): Promise<LiveMetrics> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const out: LiveMetrics = {
    events_30d: null,
    leads_30d: null,
    referrals_in_30d: null,
    referrals_out_30d: null,
    pantheon_elo: null,
    pantheon_tier: null,
  };

  if (inboundSlug) {
    try {
      const evTable = `inbound_${inboundSlug}_events`;
      const ldTable = `inbound_${inboundSlug}_leads`;
      const [{ count: ev }, { count: ld }, { count: refIn }, { count: refOut }] = await Promise.all([
        sb.from(evTable).select("id", { count: "exact", head: true }).gte("created_at", since),
        sb.from(ldTable).select("id", { count: "exact", head: true }).gte("created_at", since),
        sb.from("cross_brand_referrals").select("id", { count: "exact", head: true }).eq("target_slug", inboundSlug).gte("ts", since),
        sb.from("cross_brand_referrals").select("id", { count: "exact", head: true }).eq("originating_slug", inboundSlug).gte("ts", since),
      ]);
      out.events_30d = ev ?? 0;
      out.leads_30d = ld ?? 0;
      out.referrals_in_30d = refIn ?? 0;
      out.referrals_out_30d = refOut ?? 0;
    } catch {
      // table may not exist yet for some slugs — leave nulls
    }
  }

  if (pantheonCEO) {
    try {
      const { data } = await sb
        .from("council_agents")
        .select("elo, current_tier")
        .eq("name", pantheonCEO)
        .maybeSingle();
      if (data) {
        out.pantheon_elo = (data as { elo: number; current_tier: string }).elo;
        out.pantheon_tier = (data as { elo: number; current_tier: string }).current_tier;
      }
    } catch {
      // pantheon CEO may not be seeded
    }
  }

  return out;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) notFound();

  const metrics = await fetchMetrics(c.inboundSlug, c.pantheonCEO);
  const pageUrl = `${SITE_URL}/federation/case-studies/${c.slug}`;
  const pageTitle = `${c.brand} — Build & Pricing Case Study`;
  const status = STATUS_BADGE[c.status] || STATUS_BADGE.live;
  const tierKey = c.marketTier;

  return (
    <CaseStudyGate>
      <CaseCosmicBackground />
      <main className="min-h-screen text-zinc-100 relative z-10">
        <section className="border-b border-white/5 relative overflow-hidden">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
              Infrastructure · Development
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.4em] text-amber-400">Case study</p>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <h1 className="text-5xl sm:text-7xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                {c.brand}
              </h1>
              <span
                className="inline-block text-[10px] font-bold tracking-[0.32em] px-2 py-1 rounded mt-3"
                style={{ background: status.bg, color: status.fg }}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-6 max-w-3xl text-lg text-zinc-400">{c.tagline}</p>
            <div className="mt-3 text-xs uppercase tracking-[0.32em] text-zinc-500">
              {c.role} · Realm {c.realm === 1 ? "I" : c.realm === 2 ? "II" : "III"}
              {c.liveSince && ` · live since ${c.liveSince}`}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              {c.url !== "#" && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 font-semibold text-zinc-900 hover:bg-amber-300 transition-colors"
                >
                  Visit {c.domain} →
                </a>
              )}
              <Link
                href="/federation/case-studies"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 hover:border-amber-400 transition-colors"
              >
                ← All case studies
              </Link>
            </div>
          </div>
        </section>

        {/* Live agentic dashboard */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Agentic dashboard · live</p>
          <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
            What this node is doing right now.
          </h2>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Pulled from Supabase at request time. 30-day window unless noted.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Events (30d)" value={fmt(metrics.events_30d)} />
            <Stat label="Leads (30d)" value={fmt(metrics.leads_30d)} />
            <Stat label="Federation referrals in (30d)" value={fmt(metrics.referrals_in_30d)} />
            <Stat label="Federation referrals out (30d)" value={fmt(metrics.referrals_out_30d)} />
            <Stat label="Pantheon ELO" value={metrics.pantheon_elo !== null ? String(metrics.pantheon_elo) : "—"} />
            <Stat label="Pantheon tier" value={metrics.pantheon_tier ? metrics.pantheon_tier.toUpperCase() : "—"} accent={metrics.pantheon_tier ? "#fbbf24" : undefined} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            {c.inboundSlug ? `Source: inbound_${c.inboundSlug}_* + cross_brand_referrals` : "No inbound slug — node is read-only on the federation."}
            {c.pantheonCEO ? ` · council_agents WHERE name='${c.pantheonCEO}'` : ""}
          </p>
        </section>

        {/* Problem + Solution */}
        <section className="border-y border-white/5 bg-black/30 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Problem</p>
                <p className="mt-3 text-zinc-200 leading-relaxed">{c.problem}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Solution</p>
                <p className="mt-3 text-zinc-200 leading-relaxed">{c.solution}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Systems inventory */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Systems</p>
          <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
            Inventory of the build.
          </h2>
          <div className="mt-10 space-y-3">
            {c.systems.map((row) => (
              <article
                key={row.layer}
                className="border border-zinc-800 rounded-lg p-5 grid gap-2 sm:grid-cols-[200px_1fr] sm:items-baseline bg-zinc-900/40"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-amber-400">{row.layer}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{row.what}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Agentic stack */}
        <section className="border-y border-white/5 bg-black/30 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Agentic stack</p>
            <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
              What the AI CEO does for this node.
            </h2>
            <ul className="mt-8 space-y-4">
              {c.agenticStack.map((line, i) => (
                <li key={i} className="border-l-2 border-amber-400 pl-5 text-zinc-300 leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            {c.pantheonArchetype && (
              <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-amber-400/40 px-5 py-2 text-xs uppercase tracking-[0.32em] text-amber-300">
                Pantheon lens · {c.pantheonArchetype}
              </div>
            )}
          </div>
        </section>

        {/* Market position */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Market position · 2026</p>
          <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
            Where this build sits.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => {
              const isThis = t.key === tierKey;
              return (
                <article
                  key={t.key}
                  className={`rounded-xl border p-6 bg-zinc-950/40 ${isThis ? "border-amber-400/60" : "border-zinc-800"}`}
                >
                  <span
                    className="inline-block text-[10px] font-bold tracking-[0.3em] uppercase px-2 py-1 rounded"
                    style={{ background: t.accent, color: t.fg }}
                  >
                    {isThis ? "THIS BUILD" : t.name}
                  </span>
                  <p className="mt-2 text-xl" style={{ fontFamily: "Georgia, serif" }}>{t.name}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{t.range}</p>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{t.desc}</p>
                  <p className="mt-4 text-xs text-zinc-500 italic">{t.fits}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="border-y border-white/5 bg-black/30 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Engagement</p>
            <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
              {c.brand === "Omni AI" ? "This is the HQ. Not for sale." : `What ${c.brand} should be priced at.`}
            </h2>
            <p className="mt-4 max-w-2xl text-zinc-400">
              Build range: <strong className="text-amber-300">{c.buildPriceRange}</strong> · Tier: {c.marketTierLabel}.
            </p>
            <div className="mt-10 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3">Line item</th>
                    <th className="text-right px-5 py-3">Price</th>
                    <th className="text-left px-5 py-3 hidden sm:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {c.pricing.map((p) => (
                    <tr key={p.line} className="hover:bg-zinc-900/40">
                      <td className="px-5 py-4 font-medium">{p.line}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-amber-300">{p.price}</td>
                      <td className="px-5 py-4 text-zinc-500 text-xs hidden sm:table-cell">{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* MIDDLE share */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <ShareRow url={pageUrl} title={pageTitle} caption="Share this case study" />
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
              Want this for your business?
            </h2>
            <p className="mt-4 text-zinc-400">
              One call. We map the bottleneck and show you the federation stack that fixes it.
            </p>
            <Link
              href="/book/omni"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-400 px-8 py-4 font-semibold text-zinc-900 hover:bg-amber-300 transition-colors"
            >
              Book a strategy call →
            </Link>
          </div>
        </section>

        {/* BOTTOM share */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <ShareRow url={pageUrl} title={pageTitle} caption="Pass it forward" />
        </section>
      </main>
    </CaseStudyGate>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 px-5 py-4 bg-zinc-900/40">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</p>
    </div>
  );
}
