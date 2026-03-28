import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PATCH /api/admin/users/[id] — update any profile field
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — delete profile + credentials + activity log
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Delete credentials first (FK reference)
    await sb.from("user_credentials").delete().eq("profile_id", id);

    // Delete activity log
    await sb.from("activity_log").delete().eq("profile_id", id);

    // Delete profile
    const { error } = await sb.from("profiles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
