import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { ptStartOfDayIso } from "@/lib/tz";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/cps-data
 *
 * Returns the CPS analytics payload (leads, calls counted, top pages,
 * top buttons, recent events). Mounted on /dashboard inside the isCPS
 * branch; the page polls this every ~30s.
 *
 * Auth: only the `cps` user (username = 'cps') and admins can read it.
 * Anyone else → 403 (PII in lead rows; can't be public).
 *
 * Auth resolution mirrors /api/campaigns: bearer token (omni_token) OR
 * Supabase cookie session.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function dashboardDataUnavailable(reason: string, error: unknown) {
  console.error(`[dashboard/cps-data] ${reason}:`, error);
  return NextResponse.json(
    { error: "Dashboard data unavailable", reason },
    { status: 503 },
  );
}

async function resolveCallerProfileId(): Promise<string | null> {
  // Bearer token first (dashboard clients mint omni_token into localStorage).
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
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

export async function GET() {
  noStore();
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();

  // Only the CPS-tagged profile or any admin can read CPS analytics.
  const { data: profile } = await sb
    .from("profiles")
    .select("username, is_admin, role")
    .eq("id", callerId)
    .single();

  const isCps = profile?.username?.toLowerCase() === "cps";
  const isAdmin = profile?.is_admin === true || profile?.role === "admin";
  if (!isCps && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();
  const sinceToday = ptStartOfDayIso();

  const [
    recentLeadsResult,
    leadsTodayResult,
    leads7dResult,
    leads30dResult,
    recentEventsResult,
    pageViews7dResult,
    clicks7dResult,
    phoneClicksTodayResult,
    phoneClicks7dResult,
    topPagesResult,
    topClicksResult,
    phoneClickRowsResult,
  ] = await Promise.all([
    sb
      .from("cps_leads")
      .select(
        "id, name, email, phone, message, source, page_path, page_url, status, email_notified, telegram_notified, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),

    sb.from("cps_leads").select("*", { count: "exact", head: true }).gte("created_at", sinceToday),
    sb.from("cps_leads").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    sb.from("cps_leads").select("*", { count: "exact", head: true }).gte("created_at", since30d),

    sb
      .from("cps_events")
      .select(
        "id, event_type, event_category, action, target_id, page_path, is_phone_click, phone_number, visitor_id, session_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),

    sb
      .from("cps_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .gte("created_at", since7d),
    sb
      .from("cps_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "click")
      .gte("created_at", since7d),
    sb
      .from("cps_events")
      .select("*", { count: "exact", head: true })
      .eq("is_phone_click", true)
      .gte("created_at", sinceToday),
    sb
      .from("cps_events")
      .select("*", { count: "exact", head: true })
      .eq("is_phone_click", true)
      .gte("created_at", since7d),

    // Top-pages + top-clicks tallies sample the 2000 most recent events,
    // not an arbitrary page-order subset. On a busy week the sample
    // represents the latest activity, which is what the operator cares
    // about for "what's hot right now."
    sb
      .from("cps_events")
      .select("page_path")
      .eq("event_type", "page_view")
      .gte("created_at", since7d)
      .not("page_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000),

    sb
      .from("cps_events")
      .select("target_id")
      .eq("event_type", "click")
      .gte("created_at", since7d)
      .not("target_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000),

    sb
      .from("cps_events")
      .select("phone_number, page_path, created_at")
      .eq("is_phone_click", true)
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const queryFailures = [
    ["recent_leads_failed", recentLeadsResult],
    ["leads_today_count_failed", leadsTodayResult],
    ["leads_7d_count_failed", leads7dResult],
    ["leads_30d_count_failed", leads30dResult],
    ["recent_events_failed", recentEventsResult],
    ["page_views_7d_count_failed", pageViews7dResult],
    ["clicks_7d_count_failed", clicks7dResult],
    ["phone_clicks_today_count_failed", phoneClicksTodayResult],
    ["phone_clicks_7d_count_failed", phoneClicks7dResult],
    ["top_pages_failed", topPagesResult],
    ["top_clicks_failed", topClicksResult],
    ["phone_click_rows_failed", phoneClickRowsResult],
  ] as const;
  const failure = queryFailures.find(([, result]) => "error" in result && result.error);
  if (failure) {
    return dashboardDataUnavailable(failure[0], failure[1].error);
  }

  const recentLeads = recentLeadsResult.data;
  const leadsToday = leadsTodayResult.count;
  const leads7d = leads7dResult.count;
  const leads30d = leads30dResult.count;
  const recentEvents = recentEventsResult.data;
  const pageViews7d = pageViews7dResult.count;
  const clicks7d = clicks7dResult.count;
  const phoneClicksToday = phoneClicksTodayResult.count;
  const phoneClicks7d = phoneClicks7dResult.count;
  const topPagesRaw = topPagesResult.data;
  const topClicksRaw = topClicksResult.data;
  const phoneClickRows = phoneClickRowsResult.data;

  // Tally top pages.
  const pageTally = new Map<string, number>();
  (topPagesRaw || []).forEach((r: { page_path: string | null }) => {
    if (!r.page_path) return;
    pageTally.set(r.page_path, (pageTally.get(r.page_path) || 0) + 1);
  });
  const topPages = Array.from(pageTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Tally top buttons clicked.
  const clickTally = new Map<string, number>();
  (topClicksRaw || []).forEach((r: { target_id: string | null }) => {
    if (!r.target_id) return;
    clickTally.set(r.target_id.slice(0, 60), (clickTally.get(r.target_id.slice(0, 60)) || 0) + 1);
  });
  const topClicks = Array.from(clickTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Unique visitors / sessions in 7d (sample from recent 50).
  const visitorIds = new Set<string>();
  const sessionIds = new Set<string>();
  (recentEvents || []).forEach((e: { visitor_id: string | null; session_id: string | null }) => {
    if (e.visitor_id) visitorIds.add(e.visitor_id);
    if (e.session_id) sessionIds.add(e.session_id);
  });

  return NextResponse.json({
    leadsToday: leadsToday || 0,
    leads7d: leads7d || 0,
    leads30d: leads30d || 0,
    pageViews7d: pageViews7d || 0,
    clicks7d: clicks7d || 0,
    phoneClicksToday: phoneClicksToday || 0,
    phoneClicks7d: phoneClicks7d || 0,
    recentLeads: recentLeads || [],
    recentEvents: recentEvents || [],
    topPages,
    topClicks,
    phoneClickRows: phoneClickRows || [],
    uniqueVisitorsSample: visitorIds.size,
    uniqueSessionsSample: sessionIds.size,
    fetchedAt: new Date().toISOString(),
  });
}
