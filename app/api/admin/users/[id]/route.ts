import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/password";
import { serverErrorResponse } from "@/lib/api-errors";

// GET /api/admin/users/[id] — fetch profile credentials (admin only)
// NEVER returns the actual password hash
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const { id } = params;
    const { data: creds } = await sb
      .from("user_credentials")
      .select("username")
      .eq("profile_id", id)
      .single();
    // Return username only — never expose password hash
    return NextResponse.json({ username: creds?.username || null });
  } catch (err: unknown) {
    return serverErrorResponse("admin/users/[id].GET", err);
  }
}

// PATCH /api/admin/users/[id] — update any profile field (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const { id } = params;
    const body = await req.json();

    const allowed = [
      "name", "first_name", "last_name", "email", "phone", "timezone",
      "business_name", "business_niche", "business_details",
      "role", "tier", "tier_label", "is_admin", "is_sponsor", "sponsor_tier",
      "sponsor_activated", "sponsor_insights_paid",
      "is_subscribed", "subscription_status", "is_premium",
      "crm_status", "lead_score", "satisfaction_score",
      "last_contacted", "crm_notes", "newsletter_subscribed",
      "metadata",
      "agent_name", "agent_status", "elo_rating", "elo_rank",
    ];

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // Role cascade
    if (body.role !== undefined) {
      if (body.role === "admin") {
        updates.is_admin = true;
        updates.is_sponsor = true;
        if (!body.tier) updates.tier = 99;
        updates.tier_label = "admin";
      } else if (body.role === "sponsor") {
        updates.is_admin = false;
        updates.is_sponsor = true;
      } else {
        updates.is_admin = false;
        updates.is_sponsor = false;
      }
    }

    const { data, error } = await sb
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return serverErrorResponse("admin/users/[id].PATCH", error);

    // Update password if provided — hash before storing
    if (body.password && typeof body.password === "string" && body.password.trim()) {
      const hashedPassword = await hashPassword(body.password.trim());
      const { error: pwError } = await sb
        .from("user_credentials")
        .update({ password_hash: hashedPassword })
        .eq("profile_id", id);
      if (pwError) {
        // Keep the user-facing line specific — the caller needs to know the
        // profile persisted even though the password didn't — but scrub
        // pwError.message so the underlying constraint isn't exposed.
        return serverErrorResponse(
          "admin/users/[id].PATCH.password",
          pwError,
          500,
          "Profile saved but password update failed",
        );
      }
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (err: unknown) {
    return serverErrorResponse("admin/users/[id].PATCH", err);
  }
}

// DELETE /api/admin/users/[id] — delete profile + credentials + activity log (admin only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  try {
    const { id } = params;

    // Delete credentials first (FK reference)
    await sb.from("user_credentials").delete().eq("profile_id", id);

    // Delete activity log
    await sb.from("activity_log").delete().eq("profile_id", id);

    // Delete profile
    const { error } = await sb.from("profiles").delete().eq("id", id);
    if (error) return serverErrorResponse("admin/users/[id].DELETE", error);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return serverErrorResponse("admin/users/[id].DELETE", err);
  }
}
