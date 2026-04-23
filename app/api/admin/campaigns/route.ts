import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";
import { serverErrorResponse } from "@/lib/api-errors";

// GET /api/admin/campaigns — fetch all campaigns (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();
  const profileId = req.nextUrl.searchParams.get("profile_id");

  let query = sb
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (profileId) query = query.eq("profile_id", profileId);

  const { data, error } = await query;
  if (error) return serverErrorResponse("admin/campaigns.GET", error);
  return NextResponse.json({ campaigns: data || [] });
}

// POST /api/admin/campaigns — create a new campaign (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

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

    if (error) return serverErrorResponse("admin/campaigns.POST", error);

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
  } catch (err: unknown) {
    return serverErrorResponse("admin/campaigns.POST", err);
  }
}
