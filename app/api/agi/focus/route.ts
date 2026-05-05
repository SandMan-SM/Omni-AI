// Today's Focus — single read that returns everything an admin should
// look at today: hot leads needing first contact, stuck leads needing
// a nudge, today's meetings, businesses with cancelled meetings to
// reschedule, conversions in last 24h to celebrate.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
  noStore();
  const now = new Date();
  // "Today" is the operator's PT day, not the server's UTC day. Without the
  // PT anchor, /focus run at 7 AM PT (= 14:00 UTC) used `setHours(0)` in
  // UTC and returned meetings since 17:00 PT *yesterday* — i.e. yesterday's
  // late-afternoon items showed up under "today's meetings". Build the PT
  // calendar day, then convert to UTC ISO for the supabase filters.
  const todayPt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const [py, pm, pd] = todayPt.split('-').map(n => parseInt(n, 10));
  // 00:00 PT and 23:59:59 PT for that calendar day, expressed in UTC.
  // Add the runtime offset so we don't have to re-handle DST manually.
  function ptWallToUtc(year: number, month0: number, day: number, hour: number, minute: number, second = 0, ms = 0): Date {
    const utcGuess = new Date(Date.UTC(year, month0, day, hour, minute, second, ms));
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(utcGuess);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
    const ptHourActual = get('hour') === 24 ? 0 : get('hour');
    const offsetMin = (hour - ptHourActual) * 60 + (minute - get('minute'));
    return new Date(utcGuess.getTime() + offsetMin * 60_000);
  }
  const startOfDay = ptWallToUtc(py, pm - 1, pd, 0, 0, 0, 0);
  const endOfDay = ptWallToUtc(py, pm - 1, pd, 23, 59, 59, 999);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

  const [
    { data: hotLeadsNew },
    { data: stuckLeads },
    { data: todayMeetings },
    { data: cancelledMeetings },
    { data: recentConversions },
  ] = await Promise.all([
    // Hot leads (score >= 80) still in 'new' status — need first contact
    sb.from("omni_leads_generated")
      .select("id, business_id, first_name, last_name, company, email, score, status, ai_recommended_angle")
      .gte("score", 80)
      .eq("status", "new")
      .order("score", { ascending: false })
      .limit(8),

    // Stuck leads — open status, no update in 14+ days
    sb.from("omni_leads_generated")
      .select("id, business_id, first_name, last_name, company, score, status, updated_at")
      .not("status", "in", "(converted,lost)")
      .lte("updated_at", fourteenDaysAgo.toISOString())
      .order("score", { ascending: false })
      .limit(8),

    // Today's confirmed meetings
    sb.from("omni_meeting_bookings")
      .select("id, business_id, attendee_name, attendee_email, start_at, duration_minutes, meeting_type, lead:omni_leads_generated(first_name,last_name)")
      .eq("status", "confirmed")
      .gte("start_at", startOfDay.toISOString())
      .lte("start_at", endOfDay.toISOString())
      .order("start_at"),

    // Cancelled meetings in last 7 days that haven't been rebooked
    sb.from("omni_meeting_bookings")
      .select("id, business_id, attendee_name, attendee_email, start_at")
      .eq("status", "cancelled")
      .gte("updated_at", weekAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(5),

    // Conversions in last 24 hours — wins to celebrate
    sb.from("omni_leads_generated")
      .select("id, business_id, first_name, last_name, company, deal_value, updated_at")
      .eq("status", "converted")
      .gte("updated_at", dayAgo.toISOString())
      .order("updated_at", { ascending: false }),
  ]);

  // Resolve business names in one shot
  const allBizIds = new Set<string>();
  [hotLeadsNew, stuckLeads, todayMeetings, cancelledMeetings, recentConversions].forEach(arr => {
    (arr ?? []).forEach((r: { business_id: string | null }) => {
      if (r.business_id) allBizIds.add(r.business_id);
    });
  });
  const { data: bizs } = allBizIds.size > 0
    ? await sb.from("omni_businesses").select("id, name").in("id", Array.from(allBizIds))
    : { data: [] };
  const bizName = new Map((bizs ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

  return NextResponse.json({
    today: now.toISOString(),
    hot_new_leads: (hotLeadsNew ?? []).map(l => ({ ...l, business_name: bizName.get(l.business_id) ?? null })),
    stuck_leads:   (stuckLeads ?? []).map(l => ({ ...l, business_name: bizName.get(l.business_id) ?? null })),
    today_meetings: (todayMeetings ?? []).map(m => ({ ...m, business_name: bizName.get(m.business_id) ?? null })),
    recent_cancelled: (cancelledMeetings ?? []).map(m => ({ ...m, business_name: bizName.get(m.business_id) ?? null })),
    recent_conversions: (recentConversions ?? []).map(l => ({ ...l, business_name: bizName.get(l.business_id) ?? null })),
  });
}
