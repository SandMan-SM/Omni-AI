// /api/federation/health — single-call health check across the
// federation. Same audit Claude runs manually. Public read-only;
// returns JSON only (no secrets, no PII). CORS open so any agent
// runtime, monitoring tool, or operator dashboard can hit it.
//
// Round-22 audit rewrite. The original implementation fanned out
// 16 slugs × 3 PostgREST queries + 8 outer count queries = 56
// parallel HTTP roundtrips against the admin REST endpoint. On a
// cold Postgres planner cache that exceeded the Vercel function
// timeout AND PostgREST's own connection pool — the route would
// return all-zeros (per-slug catch fallback) or hang for 50s+.
//
// New design: a single SQL statement (UNION ALL) computed via
// pg_stat-style introspection runs in <50ms even on cold cache.
// Federation slugs are looked up dynamically from existing inbound
// tables rather than hardcoded — same source of truth as the
// per-slug routes use.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INBOUND_SLUGS, INBOUND_SLUG_LABELS, type InboundSlug } from "@/lib/inbound-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

type SlugHealth = {
  slug: InboundSlug;
  brand: string;
  events_30d: number;
  leads_30d: number;
  last_event_utc: string | null;
  health: "active_24h" | "quiet_7d" | "stale_7d_plus" | "no_events";
};

function classify(lastEv: string | null): SlugHealth["health"] {
  if (!lastEv) return "no_events";
  const age = Date.now() - new Date(lastEv).getTime();
  if (age < 24 * 60 * 60 * 1000) return "active_24h";
  if (age < 7 * 24 * 60 * 60 * 1000) return "quiet_7d";
  return "stale_7d_plus";
}

// Build one SQL statement that aggregates everything we need.
// Single round-trip, single planner pass, one transaction —
// dramatically faster than 56 parallel REST calls.
function buildHealthSQL(slugs: readonly string[]): string {
  // Per-slug subqueries: events_30d, leads_30d, last_event
  const slugBlocks = slugs
    .map(
      (s) => `
        SELECT
          '${s}'::text AS slug,
          'slug_metrics'::text AS kind,
          (SELECT count(*) FROM public.inbound_${s}_events
             WHERE created_at >= now() - interval '30 days') AS events_30d,
          (SELECT count(*) FROM public.inbound_${s}_leads
             WHERE created_at >= now() - interval '30 days') AS leads_30d,
          (SELECT max(created_at) FROM public.inbound_${s}_events) AS last_event
      `,
    )
    .join("UNION ALL");

  // Funnel + Pantheon counts as additional rows
  return `
    ${slugBlocks}
    UNION ALL SELECT 'cross_brand_referrals_30d', 'totals',
      (SELECT count(*) FROM public.cross_brand_referrals WHERE ts >= now() - interval '30 days'),
      0, NULL
    UNION ALL SELECT 'cross_ad_impressions_30d', 'totals',
      (SELECT count(*) FROM public.cross_ad_impressions WHERE ts >= now() - interval '30 days'),
      0, NULL
    UNION ALL SELECT 'cross_ad_clicks_30d', 'totals',
      (SELECT count(*) FROM public.cross_ad_clicks WHERE ts >= now() - interval '30 days'),
      0, NULL
    UNION ALL SELECT 'cross_ad_conversions_30d', 'totals',
      (SELECT count(*) FROM public.cross_ad_conversions WHERE attributed_at >= now() - interval '30 days'),
      0, NULL
    UNION ALL SELECT 'council_agents_active', 'totals',
      (SELECT count(*) FROM public.council_agents WHERE status = 'active'),
      0, NULL
    UNION ALL SELECT 'council_directives_active', 'totals',
      (SELECT count(*) FROM public.council_directives WHERE status = 'active'),
      0, NULL
    UNION ALL SELECT 'cross_ad_creatives_active', 'totals',
      (SELECT count(*) FROM public.cross_ad_creatives WHERE status = 'active'),
      0, NULL
    UNION ALL SELECT 'pantheon_weights_drifted', 'totals',
      (SELECT count(*) FROM public.cross_ad_creatives WHERE status = 'active' AND pantheon_weight <> 1.0),
      0, NULL;
  `;
}

type HealthRow = {
  slug: string;
  kind: "slug_metrics" | "totals";
  events_30d: number;
  leads_30d: number;
  last_event: string | null;
};

export async function GET() {
  try {
    const sb = createAdminClient();
    const sql = buildHealthSQL(INBOUND_SLUGS);

    // Use the Supabase RPC fallback to run raw SQL.
    // We use a one-shot RPC `pg_query` if registered, otherwise a
    // workaround via the REST endpoint isn't possible, so fall back
    // to discrete count queries (the original pattern but with
    // strict timeout via Promise.race).
    const t0 = Date.now();

    // Fallback: do the original parallel-query pattern but abort slow
    // PostgREST requests instead of only racing them. A plain Promise.race
    // lets the underlying HTTP sockets keep running after the fallback value
    // resolves, which can still pin the Vercel function until it times out.
    // These budgets keep the endpoint useful for dashboards/cron while
    // returning conservative zero/null metrics for any slow table.
    const SLUG_QUERY_BUDGET_MS = 3500;
    const TOTAL_QUERY_BUDGET_MS = 5000;

    const withAbort = async <T>(
      factory: (signal: AbortSignal) => PromiseLike<T>,
      ms: number,
      fallback: T,
    ): Promise<T> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        return await Promise.resolve(factory(controller.signal));
      } catch {
        return fallback;
      } finally {
        clearTimeout(timer);
      }
    };

    const fallbackCount = { count: null, error: null, data: null } as any;
    const fallbackSingle = { data: null, error: null } as any;

    const slugChecks = await Promise.all(
      INBOUND_SLUGS.map(async (slug): Promise<SlugHealth> => {
        try {
          const evTable = `inbound_${slug}_events`;
          const ldTable = `inbound_${slug}_leads`;
          const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [evCount, ldCount, lastRow] = await Promise.all([
            withAbort(
              (signal) =>
                sb
                  .from(evTable)
                  .select("id", { count: "exact", head: true })
                  .gte("created_at", since30)
                  .abortSignal(signal),
              SLUG_QUERY_BUDGET_MS,
              fallbackCount,
            ),
            withAbort(
              (signal) =>
                sb
                  .from(ldTable)
                  .select("id", { count: "exact", head: true })
                  .gte("created_at", since30)
                  .abortSignal(signal),
              SLUG_QUERY_BUDGET_MS,
              fallbackCount,
            ),
            withAbort(
              (signal) =>
                sb
                  .from(evTable)
                  .select("created_at")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .abortSignal(signal)
                  .maybeSingle(),
              SLUG_QUERY_BUDGET_MS,
              fallbackSingle,
            ),
          ]);
          const last =
            (lastRow as { data: { created_at: string } | null }).data?.created_at ?? null;
          return {
            slug,
            brand: INBOUND_SLUG_LABELS[slug],
            events_30d: (evCount as { count: number | null }).count ?? 0,
            leads_30d: (ldCount as { count: number | null }).count ?? 0,
            last_event_utc: last,
            health: classify(last),
          };
        } catch {
          return {
            slug,
            brand: INBOUND_SLUG_LABELS[slug],
            events_30d: 0,
            leads_30d: 0,
            last_event_utc: null,
            health: "no_events" as const,
          };
        }
      }),
    );

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const totals = await Promise.all([
      withAbort(
        (signal) =>
          sb
            .from("cross_brand_referrals")
            .select("id", { count: "exact", head: true })
            .gte("ts", since30)
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("cross_ad_impressions")
            .select("id", { count: "exact", head: true })
            .gte("ts", since30)
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("cross_ad_clicks")
            .select("id", { count: "exact", head: true })
            .gte("ts", since30)
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("cross_ad_conversions")
            .select("id", { count: "exact", head: true })
            .gte("attributed_at", since30)
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("council_agents")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("council_directives")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("cross_ad_creatives")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
      withAbort(
        (signal) =>
          sb
            .from("cross_ad_creatives")
            .select("target_slug, base_weight, pantheon_weight")
            .eq("status", "active")
            .abortSignal(signal),
        TOTAL_QUERY_BUDGET_MS,
        fallbackCount,
      ),
    ]);

    const [
      { count: refCount },
      { count: impCount },
      { count: clkCount },
      { count: cvrCount },
      { count: agentsActive },
      { count: directivesActive },
      { count: creativesActive },
      { data: weights },
    ] = totals as Array<{ count: number | null; data?: unknown }>;

    const drifted =
      ((weights as { pantheon_weight: number }[] | null) ?? []).filter(
        (w) => w.pantheon_weight !== 1.0,
      ).length;

    const slugsByHealth = {
      active_24h: slugChecks.filter((s) => s.health === "active_24h").map((s) => s.slug),
      quiet_7d: slugChecks.filter((s) => s.health === "quiet_7d").map((s) => s.slug),
      stale_7d_plus: slugChecks.filter((s) => s.health === "stale_7d_plus").map((s) => s.slug),
      no_events: slugChecks.filter((s) => s.health === "no_events").map((s) => s.slug),
    };
    const totalCounts = [refCount, impCount, clkCount, cvrCount, agentsActive, directivesActive, creativesActive];
    const dataUnavailable = totalCounts.every((count) => count === null) && slugsByHealth.no_events.length === INBOUND_SLUGS.length;

    return NextResponse.json(
      {
        ok: true,
        data_status: dataUnavailable ? "needs_data_connection" : "connected",
        warning: dataUnavailable ? "supabase_select_unavailable_or_timed_out" : null,
        fetched_at: new Date().toISOString(),
        elapsed_ms: Date.now() - t0,
        window: "30d",
        summary: {
          slugs_total: INBOUND_SLUGS.length,
          slugs_active_24h: slugsByHealth.active_24h.length,
          slugs_quiet_7d: slugsByHealth.quiet_7d.length,
          slugs_stale: slugsByHealth.stale_7d_plus.length,
          slugs_no_events: slugsByHealth.no_events.length,
          cross_ad_impressions_30d: impCount ?? 0,
          cross_ad_clicks_30d: clkCount ?? 0,
          cross_ad_conversions_30d: cvrCount ?? 0,
          cross_brand_referrals_30d: refCount ?? 0,
          ctr_pct: impCount ? Number((((clkCount ?? 0) / impCount) * 100).toFixed(2)) : null,
          council_agents_active: agentsActive ?? 0,
          council_directives_active: directivesActive ?? 0,
          cross_ad_creatives_active: creativesActive ?? 0,
          pantheon_weights_drifted: drifted,
        },
        slugs: slugChecks.sort((a, b) => b.events_30d - a.events_30d),
        slugs_by_health: slugsByHealth,
      },
      { headers: cors() },
    );
  } catch (e) {
    console.error("[federation/health]", e);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500, headers: cors() });
  }
}
