import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { serverErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/admin/activity?profile_id=xxx — fetch activity (admin only)
//
// Pulls from two sources and merges by created_at desc:
//   1. activity_log — manually-logged contact events (calls, emails, notes,
//      meetings) the operator records via the AdminCRM panel.
//   2. omni_lead_activity — agentic CRM events (lead status transitions,
//      AI scoring, outreach sends, replies). Without this fallback the
//      Recent Activity card on /dashboard rendered an empty state for
//      every admin even though the system was generating activity in
//      real time — activity_log just wasn't being populated.
export async function GET(req: NextRequest) {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  // 1. Manual activity log — admin-recorded events.
  let manualQuery = sb
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (profileId) manualQuery = manualQuery.eq("profile_id", profileId);

  // 2. Agentic CRM activity — system events from leads pipeline.
  const agentic = await sb
    .from("omni_lead_activity")
    .select("id, event_type, event_subtype, lead_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: manualRows, error } = await manualQuery;
  if (error) return serverErrorResponse("admin/activity.GET", error);

  // Format an agentic event into a human-readable single line. The
  // dashboard renders subject as the main text — keep it readable for the
  // operator without forcing them to click into the lead. Examples:
  //   created → "Lead created"
  //   stage_change + subject 'qualified' → "Stage moved to Qualified"
  //   status_change + subject 'converted' → "Status marked Converted"
  function formatAgenticSubject(eventType: string | null, eventSubtype: string | null, details: unknown): string {
    const summary = (details && typeof details === "object" && "summary" in details
      ? String((details as Record<string, unknown>).summary)
      : null);
    if (summary) return summary;
    const cap = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (eventType === "created") return "Lead created";
    if (eventType === "stage_change" && eventSubtype) return `Stage moved to ${cap(eventSubtype)}`;
    if (eventType === "status_change" && eventSubtype) return `Status marked ${cap(eventSubtype)}`;
    if (eventType && eventSubtype) return `${cap(eventType)} · ${cap(eventSubtype)}`;
    if (eventType) return cap(eventType);
    return eventSubtype ? cap(eventSubtype) : "Activity";
  }

  // Coerce both shapes into the dashboard's expected payload:
  //   { id, type, subject, channel, created_at }
  const merged = [
    ...(manualRows || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      type: (r.type as string) ?? "note",
      subject: (r.subject as string | null) ?? null,
      channel: (r.channel as string) ?? "manual",
      created_at: r.created_at as string,
    })),
    ...((agentic.data || []).map((r) => ({
      id: r.id,
      type: r.event_type ?? "system",
      subject: formatAgenticSubject(r.event_type, r.event_subtype, r.details),
      channel: "agentic",
      created_at: r.created_at,
    }))),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return NextResponse.json({ activities: merged });
}

// POST /api/admin/activity — log a new activity (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const body = await req.json();
    const { profile_id, type, subject, body: msgBody, channel, direction } = body;

    if (!profile_id || !type) {
      return NextResponse.json({ error: "profile_id and type are required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("activity_log")
      .insert({
        profile_id,
        type,
        subject: subject || null,
        body: msgBody || null,
        channel: channel || "note",
        direction: direction || "outbound",
        created_by: "admin",
      })
      .select()
      .single();

    if (error) return serverErrorResponse("admin/activity.POST", error);

    // Also update last_contacted on the profile
    await sb.from("profiles").update({ last_contacted: new Date().toISOString() }).eq("id", profile_id);

    // Log event (fire-and-forget)
    logEvent(sb, {
      actor_type: 'user',
      actor_id: 'admin',
      event_type: 'activity_logged',
      event_category: 'crm',
      action: 'create',
      target_type: 'profile',
      target_id: profile_id,
      value_text: `${type}: ${subject || ''}`,
      properties: { channel, direction },
    });

    return NextResponse.json({ success: true, activity: data });
  } catch (err: unknown) {
    return serverErrorResponse("admin/activity.POST", err);
  }
}
