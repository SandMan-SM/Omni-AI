import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { serverErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

/**
 * Admin analytics aggregation endpoint.
 *
 * Consumed by <AdminOverview /> Traffic panel. Returns a compact payload
 * with headline counts, a 14-day timeseries, top pages, top click targets,
 * top referrers, and device breakdown. All reads are admin-guarded via
 * requireAdmin().
 *
 * We do the grouping in-memory instead of SQL because the `events` table
 * is small today — this keeps the route self-contained without needing
 * new SQL views. If volume grows past ~50k events/day we should move
 * these rollups into materialized views.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  // Pull last 30 days of tracker-relevant events in one go. That bounds the
  // working set and covers every window we report (24h, 7d, 14d).
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data, error } = await sb
    .from('events')
    .select(
      'event_type,event_category,action,page_url,session_id,actor_id,actor_type,target_id,value_text,user_agent,properties,created_at'
    )
    .gte('created_at', since30d)
    .in('event_type', ['page_view', 'click', 'form_submit'])
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) {
    return serverErrorResponse('admin/analytics.GET', error);
  }

  const now = Date.now();
  const day = 86_400_000;
  const within = (row: any, ms: number) =>
    new Date(row.created_at).getTime() >= now - ms;

  const rows = data || [];
  const pageViews = rows.filter(r => r.event_type === 'page_view');
  const clicks = rows.filter(r => r.event_type === 'click');
  const submits = rows.filter(r => r.event_type === 'form_submit');

  // ── Headline counts ─────────────────────────────────────────────────
  const uniq = (arr: any[], key: string) =>
    new Set(arr.map(r => r[key]).filter(Boolean)).size;

  const traffic = {
    pageViews24h: pageViews.filter(r => within(r, day)).length,
    pageViews7d: pageViews.filter(r => within(r, 7 * day)).length,
    pageViews30d: pageViews.length,
    sessions24h: uniq(pageViews.filter(r => within(r, day)), 'session_id'),
    sessions7d: uniq(pageViews.filter(r => within(r, 7 * day)), 'session_id'),
    visitors24h: uniq(pageViews.filter(r => within(r, day)), 'actor_id'),
    visitors7d: uniq(pageViews.filter(r => within(r, 7 * day)), 'actor_id'),
    clicks24h: clicks.filter(r => within(r, day)).length,
    clicks7d: clicks.filter(r => within(r, 7 * day)).length,
    formSubmits7d: submits.filter(r => within(r, 7 * day)).length,
  };

  // ── 14-day daily timeseries ────────────────────────────────────────
  // Pre-seed every day so the chart has a stable 14-bucket x-axis even
  // when some days have zero traffic.
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

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    bucketMap.set(key, { page_views: 0, sessions: new Set(), clicks: 0 });
  }
  for (const r of pageViews) {
    const key = r.created_at.slice(0, 10);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.page_views += 1;
    if (r.session_id) b.sessions.add(r.session_id);
  }
  for (const r of clicks) {
    const key = r.created_at.slice(0, 10);
    const b = bucketMap.get(key);
    if (!b) continue;
    b.clicks += 1;
  }
  bucketMap.forEach((v, k) => {
    daily.push({
      day: k,
      page_views: v.page_views,
      sessions: v.sessions.size,
      clicks: v.clicks,
    });
  });

  // ── Top pages (7d) ──────────────────────────────────────────────────
  const pageAgg = new Map<string, { views: number; visitors: Set<string> }>();
  for (const r of pageViews) {
    if (!within(r, 7 * day)) continue;
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

  // ── Top clicks (7d) — grouped by the human-readable label ──────────
  const clickAgg = new Map<
    string,
    { clicks: number; pages: Set<string>; href?: string }
  >();
  for (const r of clicks) {
    if (!within(r, 7 * day)) continue;
    const label = (r.target_id || r.value_text || 'unknown').toString().slice(0, 80);
    const row = clickAgg.get(label) || {
      clicks: 0,
      pages: new Set<string>(),
    };
    row.clicks += 1;
    if (r.page_url) row.pages.add(r.page_url.split('?')[0]);
    if (!row.href && r.properties?.href) row.href = String(r.properties.href);
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

  // ── Referrers (7d) ──────────────────────────────────────────────────
  // Strip query/hash and collapse own-domain to "direct".
  const host = 'omnileadsagi.com';
  const refAgg = new Map<string, number>();
  for (const r of pageViews) {
    if (!within(r, 7 * day)) continue;
    let ref = (r.properties?.referrer as string) || '';
    if (!ref) {
      refAgg.set('direct', (refAgg.get('direct') || 0) + 1);
      continue;
    }
    try {
      const u = new URL(ref);
      if (u.hostname.includes(host)) {
        refAgg.set('internal', (refAgg.get('internal') || 0) + 1);
      } else {
        refAgg.set(u.hostname, (refAgg.get(u.hostname) || 0) + 1);
      }
    } catch {
      refAgg.set(ref.slice(0, 60), (refAgg.get(ref.slice(0, 60)) || 0) + 1);
    }
  }
  const topReferrers = Array.from(refAgg.entries())
    .map(([referrer, sessions]) => ({ referrer, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);

  // ── Device split (7d) ───────────────────────────────────────────────
  let mobile = 0;
  let desktop = 0;
  for (const r of pageViews) {
    if (!within(r, 7 * day)) continue;
    const ua = (r.user_agent || '').toLowerCase();
    if (/mobile|iphone|android/.test(ua)) mobile += 1;
    else desktop += 1;
  }

  return NextResponse.json({
    traffic,
    daily,
    topPages,
    topClicks,
    topReferrers,
    devices: { mobile, desktop },
  });
}
