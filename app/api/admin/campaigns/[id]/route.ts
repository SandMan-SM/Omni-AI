import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serverErrorResponse } from "@/lib/api-errors";

// PATCH /api/admin/campaigns/[id] — update a campaign (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const body = await req.json();
    const allowed = ["name", "status", "type", "budget", "platform", "description", "profile_id", "thumbnail"];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await sb
      .from("campaigns")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    // Swap raw .message for a tagged server-logged error. Previously these
    // responses leaked Postgres constraint / column detail on bad PATCH
    // payloads; now the schema stays opaque to an admin-session holder.
    if (error) return serverErrorResponse("admin/campaigns/[id].PATCH", error);
    return NextResponse.json({ campaign: data });
  } catch (err: unknown) {
    return serverErrorResponse("admin/campaigns/[id].PATCH", err);
  }
}

// DELETE /api/admin/campaigns/[id] (admin only)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const { error } = await sb.from("campaigns").delete().eq("id", params.id);
  if (error) return serverErrorResponse("admin/campaigns/[id].DELETE", error);
  return NextResponse.json({ success: true });
}
