import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeOmniToken, isOmniTokenPayloadFresh } from '@/lib/omni-token';
import { hasPlatformDashboardAccess } from '@/lib/mafi-access';
import { ptStartOfDayIso } from '@/lib/tz';
import {
  INBOUND_SLUG_LABELS,
  SLUGS_WITH_ORDERS,
  isInboundSlug,
  type InboundAnalyticsResponse,
  type InboundDeviceSplit,
  type InboundFunnel,
  type InboundKpis,
  type InboundRecentLead,
  type InboundScrollDepthBucket,
  type InboundSlug,
  type InboundTimeSeriesPoint,
  type InboundTopCta,
  type InboundTopPage,
  type InboundTrafficSource,
} from '@/lib/inbound-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/inbound/[slug]
 *
 * Returns the per-brand inbound analytics payload, aggregated from the
 * `inbound_{slug}_leads`, `inbound_{slug}_bookings`,
 * `inbound_{slug}_orders` (LTB only) and `inbound_{slug}_events` tables.
 *
 * Auth resolution mirrors /api/dashboard/cps-data:
 *   - bearer omni_token (base64 JSON with `sub` + optional `exp`), OR
 *   - Supabase cookie session.
 *
 * Required env: SUPABASE_SERVICE_ROLE_KEY (the admin client bypasses RLS
 * because aggregation across all rows is required).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LEADS_LIMIT = 25;
const TOP_LIMIT = 10;
const EVENT_FETCH_LIMIT = 5000;

async function resolveCallerProfileId(): Promise<string | null> {
  // Bearer token first.
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) {
        return payload.sub;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* read-only */
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

type EventRow = {
  event_type: string | null;
  path: string | null;
  referrer: string | null;
  payload: Record<string, unknown> | null;
  session_id: string | null;
  utm_source: string | null;
  device_type: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  source: string | null;
  utm_source: string | null;
  page_path: string | null;
  created_at: string;
};

type BookingRow = { created_at: string };
type OrderRow = { total: number | null; created_at: string };

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildTimeSeries(
  events: EventRow[],
  leads: LeadRow[],
  bookings: BookingRow[],
  orders: OrderRow[],
  hasOrders: boolean,
): InboundTimeSeriesPoint[] {
  // Build 30 trailing days inclusive of today (UTC).
  const points: InboundTimeSeriesPoint[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const map = new Map<string, InboundTimeSeriesPoint>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const point: InboundTimeSeriesPoint = {
      date: key,
      page_views: 0,
      leads: 0,
      bookings: 0,
      orders: 0,
    };
    points.push(point);
    map.set(key, point);
  }

  for (const e of events) {
    if (e.event_type !== 'page_view') continue;
    const k = dateKey(e.created_at);
    const p = map.get(k);
    if (p) p.page_views++;
  }
  for (const l of leads) {
    const p = map.get(dateKey(l.created_at));
    if (p) p.leads++;
  }
  for (const b of bookings) {
    const p = map.get(dateKey(b.created_at));
    if (p) p.bookings++;
  }
  if (hasOrders) {
    for (const o of orders) {
      const p = map.get(dateKey(o.created_at));
      if (p) p.orders++;
    }
  }

  // Touch unused-var for type-narrowing satisfiers.
  void todayIso;
  return points;
}

function dashboardDataUnavailable(reason: string, error: unknown) {
  console.error(`[dashboard/inbound] ${reason}:`, error);
  return NextResponse.json(
    { error: 'Dashboard data unavailable', reason },
    { status: 503 },
  );
}

function refererDomain(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function avgSessionSeconds(events: EventRow[]): number {
  // Group event timestamps by session_id, take (max - min) seconds, average.
  const buckets = new Map<string, { min: number; max: number }>();
  for (const e of events) {
    if (!e.session_id) continue;
    const t = new Date(e.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const b = buckets.get(e.session_id);
    if (!b) {
      buckets.set(e.session_id, { min: t, max: t });
    } else {
      if (t < b.min) b.min = t;
      if (t > b.max) b.max = t;
    }
  }
  if (buckets.size === 0) return 0;
  let total = 0;
  // Avoid Map.values() iteration which requires downlevelIteration in
  // older TS targets in this repo. Array.from is universally supported.
  Array.from(buckets.values()).forEach((b) => {
    total += Math.max(0, (b.max - b.min) / 1000);
  });
  return Math.round(total / buckets.size);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  noStore();
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug: rawSlug } = await params;
  const slug = rawSlug?.toLowerCase();
  if (!slug || !isInboundSlug(slug)) {
    return NextResponse.json({ error: 'Unknown brand slug' }, { status: 404 });
  }

  const sb = createAdminClient();

  // Auth: caller must have a profile, AND must be either:
  //   1. A platform admin (profile.role = 'admin' or 'owner'), OR
  //   2. Mapped to the brand's business_id in `omni_business_users`.
  // This makes the route safe to expose per-brand client logins (Sammy
  // sees LTB, Alira owner sees Alira, etc.) without leaking cross-tenant
  // data, while platform operators retain full visibility.
  const callerIsCanonicalAdmin = hasPlatformDashboardAccess({ id: callerId });
  const { data: profile } = callerIsCanonicalAdmin
    ? { data: { id: callerId, role: 'admin', is_admin: true } }
    : await sb
        .from('profiles')
        .select('id, role, is_admin')
        .eq('id', callerId)
        .single();
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const typedSlug = slug as InboundSlug;
  const profileRow = profile as { role?: unknown; is_admin?: unknown };
  const isPlatformAdmin =
    callerIsCanonicalAdmin ||
    profileRow.is_admin === true ||
    (typeof profileRow.role === 'string' &&
      ['admin', 'owner', 'platform'].includes(
        (profileRow.role || '').toLowerCase(),
      ));

  if (!isPlatformAdmin) {
    // Resolve the brand's business_id by slug, then verify the caller is
    // mapped via omni_business_users.
    const { data: biz } = await sb
      .from('omni_businesses')
      .select('id')
      .ilike('slug', typedSlug)
      .single();
    const businessId = (biz as { id?: string } | null)?.id;
    if (!businessId) {
      // If the business has no slug column or no row, fall back: only platform
      // admins can read. Per-brand clients are denied until the mapping exists.
      return NextResponse.json(
        { error: 'Forbidden — brand mapping required' },
        { status: 403 },
      );
    }
    const { data: membership } = await sb
      .from('omni_business_users')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', callerId)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden — not a member of this brand' },
        { status: 403 },
      );
    }
  }
  const hasOrders = SLUGS_WITH_ORDERS.has(typedSlug);

  const leadsTable = `inbound_${typedSlug}_leads`;
  const bookingsTable = `inbound_${typedSlug}_bookings`;
  const ordersTable = `inbound_${typedSlug}_orders`;
  const eventsTable = `inbound_${typedSlug}_events`;

  const now = Date.now();
  const sinceToday = ptStartOfDayIso();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();

  // KPI counts (HEAD requests for cheap exact counts)
  const kpiPromises = [
    sb.from(leadsTable).select('*', { count: 'exact', head: true }).gte('created_at', sinceToday),
    sb.from(leadsTable).select('*', { count: 'exact', head: true }).gte('created_at', since7d),
    sb.from(leadsTable).select('*', { count: 'exact', head: true }).gte('created_at', since30d),
    sb.from(bookingsTable).select('*', { count: 'exact', head: true }).gte('created_at', since30d),
  ] as const;

  const ordersCountPromise = hasOrders
    ? sb.from(ordersTable).select('*', { count: 'exact', head: true }).gte('created_at', since30d)
    : Promise.resolve({ count: null, error: null } as { count: number | null; error: unknown });

  const ordersRowsPromise = hasOrders
    ? sb
        .from(ordersTable)
        .select('total, created_at')
        .gte('created_at', since30d)
    : Promise.resolve({ data: [] as OrderRow[], error: null } as {
        data: OrderRow[];
        error: unknown;
      });

  const recentLeadsPromise = sb
    .from(leadsTable)
    .select('id, full_name, email, source, utm_source, page_path, created_at')
    .order('created_at', { ascending: false })
    .limit(RECENT_LEADS_LIMIT);

  const leads30dPromise = sb
    .from(leadsTable)
    .select('id, full_name, email, source, utm_source, page_path, created_at')
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(EVENT_FETCH_LIMIT);

  const bookings30dPromise = sb
    .from(bookingsTable)
    .select('created_at')
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(EVENT_FETCH_LIMIT);

  const events30dPromise = sb
    .from(eventsTable)
    .select(
      'event_type, path, referrer, payload, session_id, utm_source, device_type, created_at',
    )
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(EVENT_FETCH_LIMIT);

  const [
    leadsTodayResult,
    leads7dResult,
    leads30dCountResult,
    bookings30dCountResult,
    ordersCountResult,
    ordersRowsResult,
    recentLeadsResult,
    leads30dResult,
    bookings30dResult,
    events30dResult,
  ] = await Promise.all([
    ...kpiPromises,
    ordersCountPromise,
    ordersRowsPromise,
    recentLeadsPromise,
    leads30dPromise,
    bookings30dPromise,
    events30dPromise,
  ]);

  const queryFailures = [
    ['leads_today_count_failed', leadsTodayResult],
    ['leads_7d_count_failed', leads7dResult],
    ['leads_30d_count_failed', leads30dCountResult],
    ['bookings_30d_count_failed', bookings30dCountResult],
    ['orders_30d_count_failed', ordersCountResult],
    ['orders_rows_failed', ordersRowsResult],
    ['recent_leads_failed', recentLeadsResult],
    ['leads_30d_rows_failed', leads30dResult],
    ['bookings_30d_rows_failed', bookings30dResult],
    ['events_30d_rows_failed', events30dResult],
  ] as const;
  const failure = queryFailures.find(([, result]) => 'error' in result && result.error);
  if (failure) {
    return dashboardDataUnavailable(failure[0], failure[1].error);
  }

  const leadsToday = leadsTodayResult.count;
  const leads7d = leads7dResult.count;
  const leads30d = leads30dCountResult.count;
  const bookings30d = bookings30dCountResult.count;

  const recentLeads = (recentLeadsResult.data ?? []) as InboundRecentLead[];
  const leads30dRows = (leads30dResult.data ?? []) as LeadRow[];
  const bookings30dRows = (bookings30dResult.data ?? []) as BookingRow[];
  const events = (events30dResult.data ?? []) as EventRow[];
  const orders30dRows = (ordersRowsResult.data ?? []) as OrderRow[];

  // Funnel counts derived from the 30d event window + lead/booking/order tables.
  const funnel: InboundFunnel = {
    page_view_count: 0,
    cta_click_count: 0,
    form_submit_count: 0,
    lead_count: leads30d ?? 0,
    booking_count: bookings30d ?? 0,
    order_count: hasOrders ? ordersCountResult.count ?? 0 : null,
  };

  // Per-path tallies for top pages and conversion rate
  const pageViewByPath = new Map<string, number>();
  const formSubmitByPath = new Map<string, number>();
  const ctaTally = new Map<string, number>();
  const trafficTally = new Map<string, number>();
  const scrollBuckets: InboundScrollDepthBucket[] = [
    { bucket: 25, count: 0 },
    { bucket: 50, count: 0 },
    { bucket: 75, count: 0 },
    { bucket: 100, count: 0 },
  ];
  const deviceTally = new Map<string, number>();
  const visitorSessions = new Set<string>();

  for (const e of events) {
    if (e.session_id) visitorSessions.add(e.session_id);

    // Device split
    const device = (e.device_type || 'unknown').toLowerCase();
    deviceTally.set(device, (deviceTally.get(device) || 0) + 1);

    // Traffic source = utm_source if present, else referrer domain, else "direct"
    const refDomain = refererDomain(e.referrer);
    const sourceKey = (e.utm_source && e.utm_source.trim()) || refDomain || 'direct';
    trafficTally.set(sourceKey, (trafficTally.get(sourceKey) || 0) + 1);

    switch (e.event_type) {
      case 'page_view': {
        funnel.page_view_count++;
        if (e.path) pageViewByPath.set(e.path, (pageViewByPath.get(e.path) || 0) + 1);
        break;
      }
      case 'cta_click': {
        funnel.cta_click_count++;
        const cta = String(
          (e.payload && (e.payload['cta'] ?? e.payload['label'])) || 'unknown',
        ).slice(0, 80);
        ctaTally.set(cta, (ctaTally.get(cta) || 0) + 1);
        break;
      }
      case 'form_submit': {
        funnel.form_submit_count++;
        if (e.path) formSubmitByPath.set(e.path, (formSubmitByPath.get(e.path) || 0) + 1);
        break;
      }
      case 'scroll_depth': {
        const raw = e.payload && (e.payload['depth'] ?? e.payload['percent']);
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(n)) {
          // Snap to nearest bucket
          if (n >= 100) scrollBuckets[3].count++;
          else if (n >= 75) scrollBuckets[2].count++;
          else if (n >= 50) scrollBuckets[1].count++;
          else if (n >= 25) scrollBuckets[0].count++;
        }
        break;
      }
      default:
        break;
    }
  }

  const top_pages: InboundTopPage[] = Array.from(pageViewByPath.entries())
    .map(([path, page_views]) => {
      const form_submits = formSubmitByPath.get(path) || 0;
      const conversion_rate = page_views > 0 ? form_submits / page_views : 0;
      return { path, page_views, form_submits, conversion_rate };
    })
    .sort((a, b) => b.page_views - a.page_views)
    .slice(0, TOP_LIMIT);

  const top_ctas: InboundTopCta[] = Array.from(ctaTally.entries())
    .map(([cta, count]) => ({ cta, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT);

  const traffic_sources: InboundTrafficSource[] = Array.from(trafficTally.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT);

  const device_split: InboundDeviceSplit[] = Array.from(deviceTally.entries())
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);

  // Revenue total (sum of integer cents on LTB orders 30d)
  const total_revenue_30d = hasOrders
    ? orders30dRows.reduce((s, o) => s + (typeof o.total === 'number' ? o.total : 0), 0)
    : null;

  const kpis: InboundKpis = {
    total_leads_today: leadsToday ?? 0,
    total_leads_7d: leads7d ?? 0,
    total_leads_30d: leads30d ?? 0,
    total_bookings_30d: bookings30d ?? 0,
    total_orders_30d: hasOrders ? ordersCountResult.count ?? 0 : null,
    total_revenue_30d,
    unique_visitors_30d: visitorSessions.size,
    avg_session_duration: avgSessionSeconds(events),
  };

  const time_series = buildTimeSeries(
    events,
    leads30dRows,
    bookings30dRows,
    orders30dRows,
    hasOrders,
  );

  const body: InboundAnalyticsResponse = {
    slug: typedSlug,
    brand_label: INBOUND_SLUG_LABELS[typedSlug],
    has_orders: hasOrders,
    fetched_at: new Date().toISOString(),
    kpis,
    funnel,
    top_pages,
    top_ctas,
    traffic_sources,
    scroll_depth_distribution: scrollBuckets,
    device_split,
    recent_leads: recentLeads,
    time_series,
  };

  return NextResponse.json(body);
}
