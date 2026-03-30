import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/events";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/admin/campaigns — fetch all campaigns (optionally by profile_id)
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");

  let query = sb
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (profileId) query = query.eq("profile_id", profileId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data || [] });
}

// POST /api/admin/campaigns — create a new campaign
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile_id, name, status, type, budget, platform, description, thumbnail } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("campaigns")
      .insert({
        profile_id: profile_id || null,
        name,
        status: status || "draft",
        type: type || "",
        budget: budget || "$0",
        platform: platform || "",
        description: description || "",
        thumbnail: thumbnail || "from-purple-600 to-blue-500",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log event (fire-and-forget)
    logEvent(sb, {
      actor_type: 'user',
      actor_id: profile_id || 'admin',
      event_type: 'campaign_created',
      event_category: 'campaign',
      action: 'create',
      target_type: 'campaign',
      target_id: data?.id,
      value_text: name,
      properties: { status: status || 'draft', type, platform },
    });

    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
