import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { serverErrorResponse } from '@/lib/api-errors';

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
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get('range') || '30d') as Range;
  const cfg = RANGE_CONFIG[rangeParam] ?? RANGE_CONFIG['30d'];
  const range: Range = (cfg === RANGE_CONFIG[rangeParam]) ? rangeParam : '30d';

  const sb = createAdminClient();
  const since = new Date(Date.now() - cfg.ms).toISOString();

  const { data, error } = await sb
    .from('events')
    .select(
      'event_type,event_category,action,page_url,session_id,actor_id,actor_type,target_id,value_text,user_agent,properties,created_at'
    )
    .gte('created_at', since)
    .in('event_type', ['page_view', 'click', 'form_submit'])
    .order('created_at', { ascending: false })
    .limit(50000);

  if (error) {
    return serverErrorResponse('admin/analytics.GET', error);
  }

  const rows = data || [];
  const pageViews = rows.filter(r => r.event_type === 'page_view');
  const clicks = rows.filter(r => r.event_type === 'click');
  const submits = rows.filter(r => r.event_type === 'form_submit');

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
    const key = bucketKey(new Date(r.created_at).getTime(), cfg.bucketUnit);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.page_views += 1;
    if (r.session_id) b.sessions.add(r.session_id);
  }
  for (const r of clicks) {
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
  // from Google.
  const host = 'omnileadsagi.com';
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
    traffic,
    daily,
    topPages,
    topClicks,
    topReferrers,
    devices: { mobile, desktop },
  });
}
