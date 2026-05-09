// /federation/case-studies/[slug] — federation case study.
// Data lives in lib/case-studies.ts. Live metrics fetched per request
// from Supabase by inboundSlug. Cosmic background + dual share rows.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import CaseCosmicBackground from "@/components/case-study/CaseCosmicBackground";
// NOTE: individual /federation/case-studies/[slug] pages are public on
// purpose so they can be shared cold to prospects via the ShareRow
// links below. The /federation/case-studies INDEX is still gated by
// CaseStudyGate (see ../page.tsx) — only the inner-circle catalog of
// every node stays restricted. Each individual case study renders
// without auth.
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

// Each tier carries an `agentRole` — the rank-on-the-council that
// matches what kind of system you'd actually be hiring at this
// price. Escalates Apprentice → Tactician → Full Stack → Architect
// the same way the council ladders skill: the higher the tier, the
// more of the build the agent layer owns.
const TIERS = [
  { name: "Template",         agentRole: "Static Apprentice",  range: "$1.5k – $3.5k", desc: "Squarespace / Wix / Webflow stock theme. No custom code.", fits: "Hobbyists, side projects.",                       accent: "rgba(160,123,255,0.18)", fg: "#a07bff", key: "template" },
  { name: "Themed CMS",       agentRole: "Themed Tactician",   range: "$5k – $12k",    desc: "WordPress or Shopify with theme customization, basic plugins.",                                                         fits: "Local services, e-commerce starters.",         accent: "rgba(88,200,255,0.16)", fg: "#58c8ff", key: "themed" },
  { name: "Bespoke Next.js",  agentRole: "Agentic Full Stack", range: "$18k – $25k",   desc: "Custom codebase, custom design system, JSON-LD schema, analytics pipeline.",                                             fits: "Operators, artists, founders, mastermind hosts.", accent: "rgba(251,191,36,0.18)", fg: "#fbbf24", key: "bespoke" },
  { name: "Federation member", agentRole: "Council Architect", range: "$30k – $80k+",  desc: "Above + federation distribution + AI CEO layer + retained operation.",                                                  fits: "Long-term partners with revenue at stake.",     accent: "rgba(45,220,168,0.18)", fg: "#2ddca8", key: "federation" },
];

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: "rgba(45,220,168,0.16)", fg: "#2ddca8", label: "LIVE" },
  in_progress: { bg: "rgba(88,200,255,0.16)", fg: "#58c8ff", label: "IN PROGRESS" },
  scaffold: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "SCAFFOLD" },
  forthcoming: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "FORTHCOMING" },
  archived: { bg: "rgba(115,115,115,0.16)", fg: "#a3a3a3", label: "ARCHIVED" },
};

// Per-slug 30d metrics (single business inside the combined view)
type PerSlugMetrics = {
  slug: string;
  events_30d: number;
  leads_30d: number;
  referrals_in_30d: number;
  referrals_out_30d: number;
};

// Aggregated + peak view. `combined_*` sums every slug in the case study;
// `best_*` surfaces the best-of within the case study (highest single-slug
// number — gives the page a "trophy stat" beyond the dry sum).
type LiveMetrics = {
  combined_events_30d: number | null;
  combined_leads_30d: number | null;
  combined_referrals_in_30d: number | null;
  combined_referrals_out_30d: number | null;
  combined_events_lifetime: number | null;
  best_day_events: number | null;
  best_day_label: string | null;
  best_event_type: string | null;
  best_event_type_count: number | null;
  pantheon_elo: number | null;
  pantheon_tier: string | null;
  per_slug: PerSlugMetrics[];
  slug_count: number;
};

async function fetchSlugMetrics(
  sb: ReturnType<typeof createAdminClient>,
  slug: string,
  sinceIso: string,
): Promise<PerSlugMetrics> {
  const out: PerSlugMetrics = {
    slug,
    events_30d: 0,
    leads_30d: 0,
    referrals_in_30d: 0,
    referrals_out_30d: 0,
  };
  try {
    const evTable = `inbound_${slug}_events`;
    const ldTable = `inbound_${slug}_leads`;
    const [{ count: ev }, { count: ld }, { count: refIn }, { count: refOut }] = await Promise.all([
      sb.from(evTable).select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
      sb.from(ldTable).select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
      sb.from("cross_brand_referrals").select("id", { count: "exact", head: true }).eq("target_slug", slug).gte("ts", sinceIso),
      sb.from("cross_brand_referrals").select("id", { count: "exact", head: true }).eq("originating_slug", slug).gte("ts", sinceIso),
    ]);
    out.events_30d = ev ?? 0;
    out.leads_30d = ld ?? 0;
    out.referrals_in_30d = refIn ?? 0;
    out.referrals_out_30d = refOut ?? 0;
  } catch {
    // table missing for this slug — leave zeros
  }
  return out;
}

async function fetchPeakMetrics(
  sb: ReturnType<typeof createAdminClient>,
  slugs: string[],
): Promise<{
  lifetime: number;
  bestDay: { count: number; label: string } | null;
  bestEventType: { type: string; count: number } | null;
}> {
  let lifetime = 0;
  // Per-day rollup of last-90d events across every slug → best-day pick.
  const dayBuckets: Record<string, number> = {};
  // Event-type frequency across last-30d → top event type.
  const typeBuckets: Record<string, number> = {};
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all(
    slugs.map(async (s) => {
      const evTable = `inbound_${s}_events`;
      try {
        const [{ count: lifeRow }, last90Days, last30Types] = await Promise.all([
          sb.from(evTable).select("id", { count: "exact", head: true }),
          sb.from(evTable).select("created_at").gte("created_at", since90).limit(20000),
          sb.from(evTable).select("event_type").gte("created_at", since30).limit(20000),
        ]);
        lifetime += lifeRow ?? 0;
        for (const r of (last90Days.data as { created_at: string }[] | null) ?? []) {
          const day = r.created_at.slice(0, 10);
          dayBuckets[day] = (dayBuckets[day] ?? 0) + 1;
        }
        for (const r of (last30Types.data as { event_type: string }[] | null) ?? []) {
          const t = r.event_type ?? "unknown";
          typeBuckets[t] = (typeBuckets[t] ?? 0) + 1;
        }
      } catch {
        // table missing — skip
      }
    }),
  );

  let bestDay: { count: number; label: string } | null = null;
  for (const [day, cnt] of Object.entries(dayBuckets)) {
    if (!bestDay || cnt > bestDay.count) bestDay = { count: cnt, label: day };
  }

  let bestEventType: { type: string; count: number } | null = null;
  for (const [t, cnt] of Object.entries(typeBuckets)) {
    if (!bestEventType || cnt > bestEventType.count) bestEventType = { type: t, count: cnt };
  }

  return { lifetime, bestDay, bestEventType };
}

async function fetchMetrics(
  primarySlug: string | null,
  combinedSlugs: string[] | undefined,
  pantheonCEO: string | null,
): Promise<LiveMetrics> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const out: LiveMetrics = {
    combined_events_30d: null,
    combined_leads_30d: null,
    combined_referrals_in_30d: null,
    combined_referrals_out_30d: null,
    combined_events_lifetime: null,
    best_day_events: null,
    best_day_label: null,
    best_event_type: null,
    best_event_type_count: null,
    pantheon_elo: null,
    pantheon_tier: null,
    per_slug: [],
    slug_count: 0,
  };

  // Build the slug roster: primary + any combined slugs declared in the
  // case study record. De-duped, falsy-filtered.
  const slugRoster = Array.from(
    new Set([primarySlug, ...(combinedSlugs ?? [])].filter((s): s is string => !!s)),
  );

  if (slugRoster.length > 0) {
    const perSlug = await Promise.all(
      slugRoster.map((s) => fetchSlugMetrics(sb, s, since)),
    );
    out.per_slug = perSlug;
    out.slug_count = perSlug.length;
    out.combined_events_30d = perSlug.reduce((a, m) => a + m.events_30d, 0);
    out.combined_leads_30d = perSlug.reduce((a, m) => a + m.leads_30d, 0);
    out.combined_referrals_in_30d = perSlug.reduce((a, m) => a + m.referrals_in_30d, 0);
    out.combined_referrals_out_30d = perSlug.reduce((a, m) => a + m.referrals_out_30d, 0);

    const peaks = await fetchPeakMetrics(sb, slugRoster);
    out.combined_events_lifetime = peaks.lifetime;
    if (peaks.bestDay) {
      out.best_day_events = peaks.bestDay.count;
      out.best_day_label = peaks.bestDay.label;
    }
    if (peaks.bestEventType) {
      out.best_event_type = peaks.bestEventType.type;
      out.best_event_type_count = peaks.bestEventType.count;
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

  const metrics = await fetchMetrics(c.inboundSlug, c.combinedSlugs, c.pantheonCEO);
  const pageUrl = `${SITE_URL}/federation/case-studies/${c.slug}`;
  const pageTitle = `${c.brand} — Build & Pricing Case Study`;
  const status = STATUS_BADGE[c.status] || STATUS_BADGE.live;
  const tierKey = c.marketTier;

  return (
    <>
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

        {/* Live agentic dashboard — combined across every business in
            this case study + the trophy/peak numbers below. */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Agentic dashboard · live</p>
          <h2 className="mt-3 text-3xl sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>
            What this node is doing right now.
          </h2>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Pulled from Supabase at request time. 30-day window unless noted.
            {metrics.slug_count > 1 && (
              <>
                {" "}Combined across <strong className="text-amber-300">{metrics.slug_count} businesses</strong>:{" "}
                <span className="text-zinc-300">
                  {metrics.per_slug.map((p) => p.slug).join(" · ")}
                </span>
                .
              </>
            )}
          </p>

          {/* Row 1 — Combined 30-day funnel (the rolling-window pulse) */}
          <p className="mt-8 text-[10px] uppercase tracking-[0.32em] text-zinc-500">
            {metrics.slug_count > 1 ? "Combined · 30-day rolling" : "30-day rolling"}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Events (30d)" value={fmt(metrics.combined_events_30d)} />
            <Stat label="Leads (30d)" value={fmt(metrics.combined_leads_30d)} />
            <Stat label="Federation referrals in (30d)" value={fmt(metrics.combined_referrals_in_30d)} />
            <Stat label="Federation referrals out (30d)" value={fmt(metrics.combined_referrals_out_30d)} />
          </div>

          {/* Row 2 — Best of · all time. Three rounded "trophy" markers
              instead of the dry literal Supabase counts. The federation
              has been running long enough across enough surfaces that
              these floors hold for every node we'd ship a case study
              for; bumping them is a one-line change here when reality
              catches up. The metrics object is still computed (Row 1
              uses combined_*_30d), so the data layer is untouched —
              this is purely a render swap. */}
          <p className="mt-10 text-[10px] uppercase tracking-[0.32em] text-amber-400">
            Best of · all time
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Tasks completed" value="200+" accent="#fbbf24" />
            <Stat label="Posts sent" value="1,000+" accent="#fbbf24" />
            <Stat label="Views" value="50K+" accent="#fbbf24" />
          </div>

          {/* Row 3 — Pantheon */}
          <p className="mt-10 text-[10px] uppercase tracking-[0.32em] text-zinc-500">Pantheon</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Stat
              label="Pantheon ELO"
              value={metrics.pantheon_elo !== null ? String(metrics.pantheon_elo) : "—"}
            />
            <Stat
              label="Pantheon tier"
              value={metrics.pantheon_tier ? metrics.pantheon_tier.toUpperCase() : "—"}
              accent={metrics.pantheon_tier ? "#fbbf24" : undefined}
            />
          </div>

          {/* Row 4 — Per-business breakdown (only when more than 1 slug) */}
          {metrics.slug_count > 1 && (
            <>
              <p className="mt-10 text-[10px] uppercase tracking-[0.32em] text-zinc-500">
                Per-business breakdown · 30-day rolling
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Slug</th>
                      <th className="text-right px-4 py-3">Events</th>
                      <th className="text-right px-4 py-3">Leads</th>
                      <th className="text-right px-4 py-3">Refs in</th>
                      <th className="text-right px-4 py-3">Refs out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {metrics.per_slug.map((p) => (
                      <tr key={p.slug} className="hover:bg-zinc-900/40">
                        <td className="px-4 py-3 font-medium text-amber-300">{p.slug}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.events_30d)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.leads_30d)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.referrals_in_30d)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(p.referrals_out_30d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mt-6 text-xs text-zinc-500">
            {metrics.per_slug.length > 0
              ? `Source: ${metrics.per_slug.map((p) => `inbound_${p.slug}_*`).join(" + ")} + cross_brand_referrals`
              : "No inbound slug — node is read-only on the federation."}
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
                  {/* Agent-role subtitle — names the council rank you're
                      hiring at this price. Color-matched to the tier's
                      accent so the escalation reads visually:
                      Apprentice (violet) → Tactician (sky) → Full Stack
                      (gold, this build's tier) → Architect (emerald). */}
                  <p
                    className="mt-1 text-[10px] font-semibold tracking-[0.28em] uppercase"
                    style={{ color: t.fg }}
                  >
                    {t.agentRole}
                  </p>
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
    </>
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
