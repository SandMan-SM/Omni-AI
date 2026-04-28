// Onboard a new dashboard business (tenant). Used by the Business
// Advancement panel's "Onboard new business" quick action and any future
// admin onboarding flow.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST — create a new omni_businesses row
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const sb = createAdminClient();

  // De-dup case-insensitively
  const { data: existing } = await sb
    .from("omni_businesses")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, business: existing, existed: true });
  }

  const insert = {
    name,
    plan: body.plan ?? "starter",
    industry: body.industry ?? null,
    location: body.location ?? null,
    contact_email: body.contact_email ?? body.contactEmail ?? null,
    website: body.website ?? null,
  };

  const { data, error } = await sb
    .from("omni_businesses")
    .insert(insert)
    .select()
    .single();
  if (error) {
    console.error("[businesses POST]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Write to audit log (fire-and-forget)
  sb.from("omni_admin_audit_log").insert({
    actor: "admin",
    action: "business_onboarded",
    target_type: "business",
    target_id: data.id,
    metadata: { name: data.name, plan: data.plan },
  }).then(() => {});

  return NextResponse.json({ ok: true, business: data, existed: false });
}

// PATCH — update an existing business
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const map: Record<string, string> = {
    name: "name",
    plan: "plan",
    industry: "industry",
    location: "location",
    contactEmail: "contact_email",
    contact_email: "contact_email",
    website: "website",
  };
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "id" || v === undefined) continue;
    const col = map[k];
    if (col) update[col] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("omni_businesses")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[businesses PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, business: data });
}
