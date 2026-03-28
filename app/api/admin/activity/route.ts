import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/admin/activity?profile_id=xxx — fetch activity for a user (or all)
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  let query = sb
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profileId) query = query.eq("profile_id", profileId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: data || [] });
}

// POST /api/admin/activity — log a new activity
export async function POST(req: NextRequest) {
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also update last_contacted on the profile
    await sb.from("profiles").update({ last_contacted: new Date().toISOString() }).eq("id", profile_id);

    return NextResponse.json({ success: true, activity: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
