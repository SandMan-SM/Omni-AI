import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminOrBrandMember } from '@/lib/admin-auth';
import { serverErrorResponse } from '@/lib/api-errors';
import { INBOUND_SLUGS, type InboundSlug } from '@/lib/inbound-types';
import { fetchCachedSiteAnalyticsRollups, type CachedSiteAnalyticsRollup } from '@/lib/server/direct-postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Admin analytics aggregation endpoint — first-party event-stream view of
 * omnileadsagi.com.
 *
 * Consumed by <OmniSiteAnalytics /> on /dashboard/analytics. Returns headline
 * counts, a daily timeseries, top pages, top click targets, top referrers,
 * and device breakdown — all scoped to the time window selected by the
 * `range` query param.
 *
 *   ?range=24h   → last 24 hours, hourly buckets (24)
 *   ?range=7d    → last 7 days, daily buckets (7)
 *   ?range=30d   → last 30 days, daily buckets (30)   [default for the API]
 *   ?range=all   → up to 365 days, weekly buckets (~52)
 *
 * Auth: requireAdmin()
 */

type Range = '24h' | '7d' | '30d' | 'all';

const RANGE_CONFIG: Record<Range, { ms: number; bucketUnit: 'hour' | 'day' | 'week'; bucketCount: number; label: string }> = {
  '24h': { ms: 24 * 3_600_000,         bucketUnit: 'hour', bucketCount: 24, label: 'Last 24h'   },
  '7d':  { ms: 7  * 86_400_000,        bucketUnit: 'day',  bucketCount: 7,  label: 'Last 7 days' },
  '30d': { ms: 30 * 86_400_000,        bucketUnit: 'day',  bucketCount: 30, label: 'Last 30 days' },
  // "all time" is bounded at 365d so we don't blow the Supabase row cap;
  // every signal so far has been launched <12 months. If we cross that
  // bar we'll switch to a server-side aggregate.
  'all': { ms: 365 * 86_400_000,       bucketUnit: 'week', bucketCount: 53, label: 'All time'   },
};

// ── Event-type classification ─────────────────────────────────────
//
// Today's federation emits a much wider event vocabulary than the
// strict `['page_view', 'click', 'form_submit']` filter the analytics
// endpoint used to use. Most newsroom + personal-brand tenants only
// have the cross-promo widget (`sponsor.js`) mounted — never emits
// `page_view`, only `sponsor_view` + `sponsor_click`. The strict
// filter excluded all of that, leaving Beehive / Wasatch / Mainst /
// Alira with literally 0 rows on the Site Analytics panel.
//
// Three buckets matched against the audit of every tenant's actual
// event vocabulary:
//
//   PAGE_VIEW  — sponsor widget impressions count as page-view-
//   equivalent because for newsroom tenants the cross-promo embed
//   IS the visible surface.
//
//   CLICK      — every click-shaped engagement event, including the
//   share variants, the proposal/elitalks CTAs, and the cross-promo
//   sponsor_click. Future suffix variants (e.g. `<foo>_book_call`)
//   should be added here as Sita ships them.
//
//   CONVERSION — form submits + LTB booking/cart events. Counted
//   on the "Form Submits" KPI card.
//
// Engagement-only events (`scroll`, `scroll_depth`, `time_on_page`)
// and operational pings (`audit_ping`, `test_ping`) are filtered
// out at the DB query layer — they'd inflate counts without
// representing meaningful actions.
const PAGE_VIEW_TYPES = ['page_view', 'sponsor_view'] as const;
const CLICK_TYPES = [
  'click', 'sponsor_click', 'cta_click',
  'share', 'asset_share', 'case_share',
  'proposal_pay_intent', 'proposal_book_call',
  'elitalks_book_call',
  'elitalks_activate_full', 'elitalks_activate_klarna', 'elitalks_activate_alacarte',
] as const;
const CONVERSION_TYPES = ['form_submit', 'booking_completed', 'cart_add'] as const;
const KPI_EVENT_TYPES = [
  ...PAGE_VIEW_TYPES,
  ...CLICK_TYPES,
  ...CONVERSION_TYPES,
] as readonly string[];
const PAGE_VIEW_SET = new Set<string>(PAGE_VIEW_TYPES);
const CLICK_SET = new Set<string>(CLICK_TYPES);
const CONVERSION_SET = new Set<string>(CONVERSION_TYPES);

const BOOTSTRAP_ROLLUPS: Record<string, CachedSiteAnalyticsRollup> = {
  cps: {
    slug: 'cps',
    label: 'CPS',
    refreshedAt: null,
    pageViews30d: 1,
    visitors30d: 1,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 1 }],
  },
  leifson: {
    slug: 'leifson',
    label: 'Leifson',
    refreshedAt: null,
    pageViews30d: 19,
    visitors30d: 19,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 19 }],
  },
  ltb: {
    slug: 'ltb',
    label: 'Love Thy Barber',
    refreshedAt: null,
    pageViews30d: 317,
    visitors30d: 317,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 118 }, { page: '/book', views: 36 }],
  },
  omnileads: {
    slug: 'omnileads',
    label: 'Omni Leads',
    refreshedAt: null,
    pageViews30d: 17,
    visitors30d: 17,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 17 }],
  },
  prime_iv: {
    slug: 'prime_iv',
    label: 'Live Better',
    refreshedAt: null,
    pageViews30d: 51,
    visitors30d: 51,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 51 }],
  },
  youngs: {
    slug: 'youngs',
    label: 'Youngs',
    refreshedAt: null,
    pageViews30d: 57,
    visitors30d: 57,
    ctaClicks30d: 0,
    formSubmits30d: 0,
    topPages: [{ page: '/', views: 57 }],
  },
};

function bootstrapRollups(slugs: string[]): CachedSiteAnalyticsRollup[] {
  return slugs
    .map((slug) => BOOTSTRAP_ROLLUPS[slug])
    .filter((rollup): rollup is CachedSiteAnalyticsRollup => Boolean(rollup));
}

function cachedAnalyticsResponse(
  rollups: CachedSiteAnalyticsRollup[],
  context: {
    range: Range;
    rangeLabel: string;
    bucketUnit: 'hour' | 'day' | 'week';
    host: string;
  },
) {
  const pageViews = rollups.reduce((sum, row) => sum + row.pageViews30d, 0);
  const visitors = rollups.reduce((sum, row) => sum + row.visitors30d, 0);
  const clicks = rollups.reduce((sum, row) => sum + row.ctaClicks30d, 0);
  const formSubmits = rollups.reduce((sum, row) => sum + row.formSubmits30d, 0);
  const pageAgg = new Map<string, { views: number; visitors: number }>();

  for (const rollup of rollups) {
    for (const page of rollup.topPages) {
      const pageUrl = rollups.length > 1 ? `${rollup.label}: ${page.page}` : page.page;
      const current = pageAgg.get(pageUrl) ?? { views: 0, visitors: 0 };
      current.views += Number(page.views || 0);
      current.visitors += Number(page.views || 0);
      pageAgg.set(pageUrl, current);
    }
  }

  const topPages = Array.from(pageAgg.entries())
    .map(([page_url, row]) => ({ page_url, views: row.views, visitors: row.visitors }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return NextResponse.json({
    range: context.range,
    rangeLabel: context.rangeLabel,
    bucketUnit: context.bucketUnit,
    host: context.host,
    source: 'operator_site_rollups',
    cached: true,
    refreshedAt: rollups
      .map((row) => row.refreshedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null,
    traffic: {
      pageViews,
      sessions: visitors,
      visitors,
      clicks,
      formSubmits,
      pageViews24h: 0,
      pageViews7d: pageViews,
      pageViews30d: pageViews,
      sessions24h: 0,
      sessions7d: visitors,
      visitors24h: 0,
      visitors7d: visitors,
      clicks24h: 0,
      clicks7d: clicks,
      formSubmits24h: 0,
      formSubmits7d: formSubmits,
    },
    daily: [],
    topPages,
    topClicks: [],
    topReferrers: [],
    devices: { mobile: 0, desktop: visitors },
  });
}

function bucketKey(ts: number, unit: 'hour' | 'day' | 'week'): string {
  const d = new Date(ts);
  if (unit === 'hour') {
    return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  }
  if (unit === 'day') {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  // ISO week — rough but stable. Anchor at Sunday 00:00 UTC.
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - dow);
  return day.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  noStore();

  // Auth is admin-or-brand-member: platform admins see everything;
  // per-brand client viewers (Sammy@CPS, Adam@LTB, etc.) get scoped
  // to their own slug/host via the omni_business_users mapping. The
  // helper enforces that slug=all (federation rollup) stays admin-
  // only, so the rollup branch below doesn't need a separate guard.
  // Resolve scope params BEFORE the auth check so the helper can
  // authorize against them.
  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get('range') || '30d') as Range;
  const cfg = RANGE_CONFIG[rangeParam] ?? RANGE_CONFIG['30d'];
  const range: Range = (cfg === RANGE_CONFIG[rangeParam]) ? rangeParam : '30d';

  const authSlug = (url.searchParams.get('slug') || '').trim().toLowerCase();
  const authHost = (url.searchParams.get('host') || '').trim().toLowerCase();
  const auth = await requireAdminOrBrandMember({ slug: authSlug, host: authHost });
  if (auth.error) return auth.error;

  // Per-tenant scope. Three ways to scope:
  //
  //   1. ?slug=all → admin-only rollup. Reads every inbound_<slug>_events
  //      partition AND the central `events` table for omnileadsagi.com,
  //      sums them into one view. Used by the "All Businesses" option
  //      in the workspace dropdown (visible only to $Mafi). Returns the
  //      same JSON shape as a single-tenant query so the dashboard's
  //      OmniSiteAnalytics renderer doesn't need to branch.
  //
  //   2. ?slug=<INBOUND_SLUGS member> → reads inbound_<slug>_events
  //      directly. Used when the dashboard's workspace selector picks
  //      a federation tenant (Sitani Mafi, CPS, etc) whose site
  //      doesn't write into the central `events` table — its tracker
  //      writes into its own inbound_<slug>_events partition.
  //
  //   3. ?host=<hostname> → filters the central `events` table to
  //      rows whose page_url matches the host. Used for omnileadsagi.com
  //      (the only tenant that actually writes into `events`) and
  //      preserved for backward compatibility.
  //
  // slug=all wins over slug=<slug> wins over host=.
  const slugParam = (url.searchParams.get('slug') || '').trim().toLowerCase() as InboundSlug;
  const isAllRollup = slugParam === ('all' as unknown as InboundSlug);
  const isValidSlug = !isAllRollup && (INBOUND_SLUGS as readonly string[]).includes(slugParam);
  const hostParam = (url.searchParams.get('host') || '').trim().toLowerCase();
  const host = isAllRollup
    ? 'federation'
    : (isValidSlug ? slugParam : (hostParam || 'omnileadsagi.com'));

  if (isAllRollup || isValidSlug) {
    const cachedSlugs = isAllRollup ? [...INBOUND_SLUGS] : [slugParam];
    const cached = await fetchCachedSiteAnalyticsRollups(cachedSlugs);
    const instantRollups = cached.length > 0 ? cached : bootstrapRollups(cachedSlugs);
    return cachedAnalyticsResponse(instantRollups, {
      range,
      rangeLabel: cfg.label,
      bucketUnit: cfg.bucketUnit,
      host,
    });
  }

  const sb = createAdminClient();
  const since = new Date(Date.now() - cfg.ms).toISOString();

  // Schema map — the inbound tables use slightly different field
  // names than `events`. We normalize at read time so the rest of the
  // pipeline (counts / top pages / referrers / devices) stays
  // unchanged regardless of source.
  type AnalyticsRow = {
    event_type?: string;
    event_category?: string | null;
    action?: string | null;
    page_url?: string | null;
    session_id?: string | null;
    actor_id?: string | null;
    actor_type?: string | null;
    target_id?: string | null;
    value_text?: string | null;
    user_agent?: string | null;
    properties?: Record<string, unknown> | null;
    created_at?: string | null;
  };

  let rows: AnalyticsRow[] = [];

  // Helper: map an inbound_<slug>_events row into the central events
  // schema so the downstream aggregator can treat both sources
  // uniformly. visitor_id → actor_id, payload → properties (with
  // referrer merged in so the top-referrers logic still finds it).
  type InboundRow = {
    event_type?: string;
    event_category?: string | null;
    action?: string | null;
    page_url?: string | null;
    session_id?: string | null;
    visitor_id?: string | null;
    target_id?: string | null;
    value_text?: string | null;
    user_agent?: string | null;
    referrer?: string | null;
    payload?: Record<string, unknown> | null;
    created_at?: string | null;
  };
  const normalizeInbound = (r: InboundRow): AnalyticsRow => ({
    event_type: r.event_type,
    event_category: r.event_category ?? null,
    action: r.action ?? null,
    page_url: r.page_url ?? null,
    session_id: r.session_id ?? null,
    actor_id: r.visitor_id ?? null,
    actor_type: null,
    target_id: r.target_id ?? null,
    value_text: r.value_text ?? null,
    user_agent: r.user_agent ?? null,
    properties: { ...(r.payload ?? {}), referrer: r.referrer ?? null },
    created_at: r.created_at ?? null,
  });

  if (isAllRollup) {
    // Federation rollup: fan out to every inbound_<slug>_events
    // partition + the central `events` table in parallel, then merge.
    // Per-tenant row caps stay tight (8k each) so the total stays
    // bounded — INBOUND_SLUGS × 8k + 8k for omnileadsagi ≈ 144k worst
    // case, well under the 250k Postgrest hard cap. session_ids are
    // already globally unique (UUID) so cross-tenant uniqueness math
    // (visitors / sessions) Just Works without re-namespacing.
    const PER_TENANT_LIMIT = 8000;
    const tenantFetches = (INBOUND_SLUGS as readonly string[]).map(async (s) => {
      const { data, error } = await sb
        .from(`inbound_${s}_events`)
        .select(
          'event_type,event_category,action,page_url,session_id,visitor_id,target_id,value_text,user_agent,referrer,payload,created_at'
        )
        .gte('created_at', since)
        .in('event_type', KPI_EVENT_TYPES as string[])
        .order('created_at', { ascending: false })
        .limit(PER_TENANT_LIMIT);
      if (error) return [] as AnalyticsRow[];
      return ((data as InboundRow[] | null) ?? []).map(normalizeInbound);
    });
    const centralFetch = sb
      .from('events')
      .select(
        'event_type,event_category,action,page_url,session_id,actor_id,actor_type,target_id,value_text,user_agent,properties,created_at'
      )
      .gte('created_at', since)
      .in('event_type', KPI_EVENT_TYPES as string[])
      .order('created_at', { ascending: false })
      .limit(PER_TENANT_LIMIT)
      .then(({ data, error }) => {
        if (error) return [] as AnalyticsRow[];
        return (data as AnalyticsRow[] | null) ?? [];
      });
    const chunks = await Promise.all([...tenantFetches, centralFetch]);
    rows = chunks.flat();
  } else if (isValidSlug) {
    // Per-tenant: query the inbound_<slug>_events partition. The slug
    // is allowlist-validated against INBOUND_SLUGS so this can't be
    // weaponized as table-name injection.
    const tableName = `inbound_${slugParam}_events`;
    const { data, error } = await sb
      .from(tableName)
      .select(
        'event_type,event_category,action,page_url,session_id,visitor_id,target_id,value_text,user_agent,referrer,payload,created_at'
      )
      .gte('created_at', since)
      .in('event_type', KPI_EVENT_TYPES as string[])
      .order('created_at', { ascending: false })
      .limit(50000);
    if (error) return serverErrorResponse('admin/analytics.GET', error);
    // Map inbound schema → events schema via the helper defined at
    // the top of the rows-fetch block so the all-rollup branch and
    // single-tenant branch stay in lockstep.
    rows = ((data as InboundRow[] | null) ?? []).map(normalizeInbound);
  } else {
    // Central events table (omnileadsagi.com + anything else routed
    // through the universal SiteTracker). Host filter applies when
    // ?host= is explicit.
    let q = sb
      .from('events')
      .select(
        'event_type,event_category,action,page_url,session_id,actor_id,actor_type,target_id,value_text,user_agent,properties,created_at'
      )
      .gte('created_at', since)
      .in('event_type', KPI_EVENT_TYPES as string[]);

    if (hostParam) {
      q = q.or(
        `page_url.ilike.https://${hostParam}/%,` +
        `page_url.ilike.https://${hostParam},` +
        `page_url.ilike.http://${hostParam}/%,` +
        `page_url.ilike.http://${hostParam}`
      );
    }

    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(50000);

    if (error) return serverErrorResponse('admin/analytics.GET', error);
    rows = (data as AnalyticsRow[] | null) ?? [];
  }
  // Classify against the broadened buckets defined at module top.
  // sponsor_view rolls into page-views so cross-promo-only tenants
  // (Beehive, Mainst, Wasatch, Alira) don't render as zeros. Every
  // share/CTA/pay-intent variant rolls into clicks. Booking +
  // cart-add count as form-submit-equivalent conversions.
  const pageViews = rows.filter(r => PAGE_VIEW_SET.has(r.event_type ?? ''));
  const clicks = rows.filter(r => CLICK_SET.has(r.event_type ?? ''));
  const submits = rows.filter(r => CONVERSION_SET.has(r.event_type ?? ''));

  const uniq = (arr: { [k: string]: unknown }[], key: string) =>
    new Set(arr.map(r => r[key]).filter(Boolean)).size;

  // ── Headline counts (active range) ─────────────────────────────────
  // We expose two shapes side-by-side:
  //   - The legacy single-range fields (pageViews/sessions/visitors/clicks/
  //     formSubmits) used by integrations that pin ?range=… and just want
  //     a flat count.
  //   - The 24h / 7d / 30d split fields used by the AdminOverview Traffic
  //     panel, which renders four "Visitors · 7d / Page Views · 7d / …"
  //     headline cards plus a "today" sub-line. The shapes were silently
  //     out of sync — every panel card rendered 0 because pageViews7d etc
  //     were undefined and got coerced to 0 by the defensive guard.
  const nowMs = Date.now();
  const cutoff24h = nowMs - 24 * 3_600_000;
  const cutoff7d  = nowMs - 7 * 86_400_000;
  const cutoff30d = nowMs - 30 * 86_400_000;

  const sinceCutoff = (arr: typeof rows, t: number) =>
    arr.filter(r => r.created_at && new Date(r.created_at as string).getTime() >= t);

  const pv24h = sinceCutoff(pageViews, cutoff24h);
  const pv7d  = sinceCutoff(pageViews, cutoff7d);
  const pv30d = sinceCutoff(pageViews, cutoff30d);
  const cl24h = sinceCutoff(clicks, cutoff24h);
  const cl7d  = sinceCutoff(clicks, cutoff7d);
  const sb24h = sinceCutoff(submits, cutoff24h);
  const sb7d  = sinceCutoff(submits, cutoff7d);

  const traffic = {
    // Legacy active-range fields
    pageViews: pageViews.length,
    sessions: uniq(pageViews, 'session_id'),
    visitors: uniq(pageViews, 'actor_id'),
    clicks: clicks.length,
    formSubmits: submits.length,
    // Time-bucketed fields the AdminOverview panel reads
    pageViews24h: pv24h.length,
    pageViews7d:  pv7d.length,
    pageViews30d: pv30d.length,
    sessions24h:  uniq(pv24h, 'session_id'),
    sessions7d:   uniq(pv7d, 'session_id'),
    visitors24h:  uniq(pv24h, 'actor_id'),
    visitors7d:   uniq(pv7d, 'actor_id'),
    clicks24h:    cl24h.length,
    clicks7d:     cl7d.length,
    formSubmits24h: sb24h.length,
    formSubmits7d:  sb7d.length,
  };

  // ── Daily/hourly/weekly timeseries ─────────────────────────────────
  // Pre-seed every bucket so the chart has a stable x-axis even when
  // some buckets have zero traffic.
  const now = Date.now();
  const daily: {
    day: string;
    page_views: number;
    sessions: number;
    clicks: number;
  }[] = [];
  const bucketMap = new Map<
    string,
    { page_views: number; sessions: Set<string>; clicks: number }
  >();

  for (let i = cfg.bucketCount - 1; i >= 0; i--) {
    const stepMs =
      cfg.bucketUnit === 'hour' ? 3_600_000
      : cfg.bucketUnit === 'day' ? 86_400_000
      : 7 * 86_400_000;
    const key = bucketKey(now - i * stepMs, cfg.bucketUnit);
    bucketMap.set(key, { page_views: 0, sessions: new Set(), clicks: 0 });
  }
  for (const r of pageViews) {
    if (!r.created_at) continue;
    const key = bucketKey(new Date(r.created_at).getTime(), cfg.bucketUnit);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.page_views += 1;
    if (r.session_id) b.sessions.add(r.session_id);
  }
  for (const r of clicks) {
    if (!r.created_at) continue;
    const key = bucketKey(new Date(r.created_at).getTime(), cfg.bucketUnit);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.clicks += 1;
  }
  Array.from(bucketMap.entries()).forEach(([k, v]) => {
    daily.push({
      day: k,
      page_views: v.page_views,
      sessions: v.sessions.size,
      clicks: v.clicks,
    });
  });

  // ── Top pages (active range) ───────────────────────────────────────
  const pageAgg = new Map<string, { views: number; visitors: Set<string> }>();
  for (const r of pageViews) {
    const url = (r.page_url || '').split('?')[0] || '/';
    if (!url) continue;
    const row = pageAgg.get(url) || { views: 0, visitors: new Set() };
    row.views += 1;
    if (r.actor_id) row.visitors.add(r.actor_id);
    pageAgg.set(url, row);
  }
  const topPages = Array.from(pageAgg.entries())
    .map(([page_url, v]) => ({
      page_url,
      views: v.views,
      visitors: v.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // ── Top click targets ──────────────────────────────────────────────
  const clickAgg = new Map<
    string,
    { clicks: number; pages: Set<string>; href?: string }
  >();
  for (const r of clicks) {
    const label = (r.target_id || r.value_text || 'unknown').toString().slice(0, 80);
    const row = clickAgg.get(label) || {
      clicks: 0,
      pages: new Set<string>(),
    };
    row.clicks += 1;
    if (r.page_url) row.pages.add(r.page_url.split('?')[0]);
    if (!row.href && (r.properties as { href?: string })?.href) {
      row.href = String((r.properties as { href?: string }).href);
    }
    clickAgg.set(label, row);
  }
  const topClicks = Array.from(clickAgg.entries())
    .map(([label, v]) => ({
      label,
      clicks: v.clicks,
      pages: Array.from(v.pages).slice(0, 3),
      href: v.href || null,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 15);

  // ── Referrers ──────────────────────────────────────────────────────
  // Track unique session_ids per referrer so the card reads "X sessions"
  // truthfully. The previous version incremented per page_view, which made
  // a single visitor with 10 page-views from Google show as 10 "sessions"
  // from Google. `host` resolved above (per-tenant or default omnileadsagi).
  const refSessions = new Map<string, Set<string>>();
  const addSession = (key: string, sid: string | null | undefined) => {
    if (!sid) return;
    let set = refSessions.get(key);
    if (!set) { set = new Set(); refSessions.set(key, set); }
    set.add(sid);
  };
  for (const r of pageViews) {
    const sid = (r.session_id as string | null | undefined) ?? null;
    let ref = ((r.properties as { referrer?: string })?.referrer) || '';
    if (!ref) { addSession('direct', sid); continue; }
    try {
      const u = new URL(ref);
      if (u.hostname.includes(host)) addSession('internal', sid);
      else addSession(u.hostname, sid);
    } catch {
      addSession(ref.slice(0, 60), sid);
    }
  }
  const topReferrers = Array.from(refSessions.entries())
    .map(([referrer, set]) => ({ referrer, sessions: set.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);

  // ── Device split ───────────────────────────────────────────────────
  // Count UNIQUE sessions per device class, not raw page-view rows. The
  // operator reads "Desktop · 42" as "42 desktop visitors" — counting
  // events conflated visitors with pageviews and inflated the number on
  // any visitor who scrolled more than one page.
  const mobileSessions = new Set<string>();
  const desktopSessions = new Set<string>();
  for (const r of pageViews) {
    const sid = r.session_id as string | null | undefined;
    if (!sid) continue;
    const ua = (r.user_agent || '').toLowerCase();
    if (/mobile|iphone|android/.test(ua)) mobileSessions.add(sid);
    else desktopSessions.add(sid);
  }
  const mobile = mobileSessions.size;
  const desktop = desktopSessions.size;

  return NextResponse.json({
    range,
    rangeLabel: cfg.label,
    bucketUnit: cfg.bucketUnit,
    host,
    traffic,
    daily,
    topPages,
    topClicks,
    topReferrers,
    devices: { mobile, desktop },
  });
}
