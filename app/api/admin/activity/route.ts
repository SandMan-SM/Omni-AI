import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { serverErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// GET /api/admin/activity?profile_id=xxx — fetch activity (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  let query = sb
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profileId) query = query.eq("profile_id", profileId);

  const { data, error } = await query;
  if (error) return serverErrorResponse("admin/activity.GET", error);
  return NextResponse.json({ activities: data || [] });
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
