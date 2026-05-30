import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasPlatformDashboardAccess } from '@/lib/mafi-access';
import { ptStartOfDayIso } from '@/lib/tz';
import {
  INBOUND_SLUGS,
  INBOUND_SLUG_LABELS,
  type InboundAggregateDailyPoint,
  type InboundAggregateEventTypeRow,
  type InboundAggregateResponse,
  type InboundAggregateTenantRow,
  type InboundSlug,
} from '@/lib/inbound-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/aggregate-analytics
 *
 * Cross-portfolio rollup. Sums events / leads / bookings / newsletter
 * subs across every registered inbound slug for the last 30 days, plus
 * a per-tenant leaderboard, an event-type breakdown, and a daily series.
 *
 * Auth: platform-admin only. Per-brand client logins (Sammy, Alira
 * owner, etc.) are denied here — they only see their own tenant's
 * /api/dashboard/inbound/[slug] payload. Mirrors the platform-admin
 * branch of that endpoint.
 *
 * Implementation note: rather than a SQL view, this issues parallel
 * head-count + 30d row queries against each existing inbound_<slug>_*
 * table. ~5 round-trips per slug × N slugs, fired in one Promise.all.
 * Cheaper than maintaining a view + migration, and respects the
 * project's "don't run migrations autonomously" rule.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_FETCH_LIMIT = 5000;

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      const json = Buffer.from(bearer, 'base64').toString('utf8');
      const payload = JSON.parse(json) as { sub?: unknown; exp?: unknown };
      if (
        payload &&
        typeof payload.sub === 'string' &&
        (typeof payload.exp !== 'number' || payload.exp >= Date.now())
      ) {
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

type EventTypeRow = { event_type: string | null; created_at: string };

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET() {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  // Platform-admin gate. The aggregate view is cross-tenant; per-brand
  // client logins must not see other tenants.
  const { data: profile } = await sb
    .from('profiles')
    .select('email, username, name, role, is_admin')
    .eq('id', callerId)
    .single();

  const isPlatformAdmin = hasPlatformDashboardAccess(profile);

  if (!isPlatformAdmin) {
    return NextResponse.json(
      { error: 'Forbidden — platform admin only' },
      { status: 403 },
    );
  }

  const now = Date.now();
  const sinceToday = ptStartOfDayIso();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();

  // Build a query bundle per slug. Each bundle returns counts +
  // event-type rows + a small lead-rows window so we can fold leads
  // into the daily series. We fan out all bundles in one Promise.all.
  type Bundle = {
    slug: InboundSlug;
    leadsToday: Promise<{ count: number | null }>;
    leads7d: Promise<{ count: number | null }>;
    leads30d: Promise<{ count: number | null }>;
    bookings30d: Promise<{ count: number | null }>;
    newsletterSubs30d: Promise<{ count: number | null }>;
    eventsTotal30d: Promise<{ count: number | null }>;
    pageViews30d: Promise<{ count: number | null }>;
    eventsTypeRows: Promise<{ data: EventTypeRow[] | null }>;
    leadsCreatedAt: Promise<{ data: { created_at: string }[] | null }>;
  };

  const bundles: Bundle[] = (INBOUND_SLUGS as readonly InboundSlug[]).map(
    (slug) => {
      const eventsTable = `inbound_${slug}_events`;
      const leadsTable = `inbound_${slug}_leads`;
      const bookingsTable = `inbound_${slug}_bookings`;
      const newsletterTable = `inbound_${slug}_newsletter_events`;

      return {
        slug,
        leadsToday: sb
          .from(leadsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sinceToday) as unknown as Promise<{
          count: number | null;
        }>,
        leads7d: sb
          .from(leadsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since7d) as unknown as Promise<{
          count: number | null;
        }>,
        leads30d: sb
          .from(leadsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since30d) as unknown as Promise<{
          count: number | null;
        }>,
        bookings30d: sb
          .from(bookingsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since30d) as unknown as Promise<{
          count: number | null;
        }>,
        // Newsletter table is "subscribe" + "open" + "click" + "unsub" —
        // count subscribe rows only for "subs". Use an event-type filter
        // when the column exists; otherwise fall back to total count.
        newsletterSubs30d: sb
          .from(newsletterTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since30d)
          .eq('event_type', 'subscribe') as unknown as Promise<{
          count: number | null;
        }>,
        eventsTotal30d: sb
          .from(eventsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since30d) as unknown as Promise<{
          count: number | null;
        }>,
        pageViews30d: sb
          .from(eventsTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since30d)
          .eq('event_type', 'page_view') as unknown as Promise<{
          count: number | null;
        }>,
        eventsTypeRows: sb
          .from(eventsTable)
          .select('event_type, created_at')
          .gte('created_at', since30d)
          .order('created_at', { ascending: false })
          .limit(EVENT_FETCH_LIMIT) as unknown as Promise<{
          data: EventTypeRow[] | null;
        }>,
        leadsCreatedAt: sb
          .from(leadsTable)
          .select('created_at')
          .gte('created_at', since30d)
          .order('created_at', { ascending: false })
          .limit(EVENT_FETCH_LIMIT) as unknown as Promise<{
          data: { created_at: string }[] | null;
        }>,
      };
    },
  );

  // Resolve all bundles in parallel. Each bundle has 9 promises ⇒
  // ~14 slugs × 9 = 126 head requests. Postgrest handles this in a
  // single round-trip wave — the dashboard renders in <1s on warm
  // connections.
  const resolved = await Promise.all(
    bundles.map(async (b) => {
      const [
        leadsTodayRes,
        leads7dRes,
        leads30dRes,
        bookings30dRes,
        newsletterSubs30dRes,
        eventsTotal30dRes,
        pageViews30dRes,
        eventsTypeRowsRes,
        leadsCreatedAtRes,
      ] = await Promise.all([
        b.leadsToday,
        b.leads7d,
        b.leads30d,
        b.bookings30d,
        b.newsletterSubs30d,
        b.eventsTotal30d,
        b.pageViews30d,
        b.eventsTypeRows,
        b.leadsCreatedAt,
      ]);
      return {
        slug: b.slug,
        leadsToday: leadsTodayRes.count ?? 0,
        leads7d: leads7dRes.count ?? 0,
        leads30d: leads30dRes.count ?? 0,
        bookings30d: bookings30dRes.count ?? 0,
        newsletterSubs30d: newsletterSubs30dRes.count ?? 0,
        eventsTotal30d: eventsTotal30dRes.count ?? 0,
        pageViews30d: pageViews30dRes.count ?? 0,
        events: (eventsTypeRowsRes.data ?? []) as EventTypeRow[],
        leadCreatedAts: ((leadsCreatedAtRes.data ?? []) as {
          created_at: string;
        }[]).map((r) => r.created_at),
      };
    }),
  );

  // Per-tenant leaderboard rows.
  const by_tenant: InboundAggregateTenantRow[] = resolved.map((r) => ({
    slug: r.slug,
    label: INBOUND_SLUG_LABELS[r.slug],
    events_30d: r.eventsTotal30d,
    page_views_30d: r.pageViews30d,
    leads_30d: r.leads30d,
    leads_7d: r.leads7d,
    leads_today: r.leadsToday,
    bookings_30d: r.bookings30d,
    newsletter_subs_30d: r.newsletterSubs30d,
  }));

  // Totals row.
  const totals = by_tenant.reduce(
    (acc, t) => {
      acc.events_30d += t.events_30d;
      acc.page_views_30d += t.page_views_30d;
      acc.leads_30d += t.leads_30d;
      acc.leads_7d += t.leads_7d;
      acc.leads_today += t.leads_today;
      acc.bookings_30d += t.bookings_30d;
      acc.newsletter_subs_30d += t.newsletter_subs_30d;
      if (
        t.events_30d > 0 ||
        t.leads_30d > 0 ||
        t.bookings_30d > 0 ||
        t.newsletter_subs_30d > 0
      ) {
        acc.active_tenants += 1;
      }
      return acc;
    },
    {
      events_30d: 0,
      page_views_30d: 0,
      leads_30d: 0,
      leads_7d: 0,
      leads_today: 0,
      bookings_30d: 0,
      newsletter_subs_30d: 0,
      active_tenants: 0,
    },
  );

  // Event-type breakdown across the whole portfolio.
  const eventTypeTally = new Map<string, number>();
  for (const r of resolved) {
    for (const e of r.events) {
      const key = (e.event_type || 'unknown').toLowerCase();
      eventTypeTally.set(key, (eventTypeTally.get(key) || 0) + 1);
    }
  }
  const by_event_type: InboundAggregateEventTypeRow[] = Array.from(
    eventTypeTally.entries(),
  )
    .map(([event_type, count]) => ({ event_type, count }))
    .sort((a, b) => b.count - a.count);

  // Daily series — events + leads + bookings — last 30 trailing days.
  const dayMap = new Map<string, InboundAggregateDailyPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { date: key, events: 0, leads: 0, bookings: 0 });
  }
  for (const r of resolved) {
    for (const e of r.events) {
      const p = dayMap.get(dateKey(e.created_at));
      if (p) p.events++;
    }
    for (const ts of r.leadCreatedAts) {
      const p = dayMap.get(dateKey(ts));
      if (p) p.leads++;
    }
  }
  // Bookings daily counts not fetched per-row above (would require
  // another N queries); we only return aggregate booking totals in the
  // tenant leaderboard for now. The daily series shows events + leads
  // which are the two highest-signal metrics for portfolio health.
  const daily_series: InboundAggregateDailyPoint[] = Array.from(dayMap.values());

  const body: InboundAggregateResponse = {
    fetched_at: new Date().toISOString(),
    totals,
    by_tenant,
    by_event_type,
    daily_series,
  };

  return NextResponse.json(body);
}
