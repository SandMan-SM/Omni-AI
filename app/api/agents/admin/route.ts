// Admin endpoint to create and update agents (rows in `profiles` table).
// Used by the Arena management tab (components/agi/AgiArenaManager.tsx).
//
// Auth: requireAdmin() — same gate the rest of the admin surfaces use.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST — create a new agent (insert profile row)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = await req.json();
  const sb = createAdminClient();

  const insert: Record<string, unknown> = {
    agent_name: body.agentName ?? body.agent_name ?? null,
    business_name: body.businessName ?? body.business_name ?? null,
    name: body.ownerName ?? body.name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    role: body.role ?? "owner",
    tier: typeof body.tier === "number" ? body.tier : 0,
    crm_status: body.crmStatus ?? body.crm_status ?? "lead",
    lead_score: body.leadScore ?? body.lead_score ?? "warm",
    is_premium: !!body.isPremium,
    is_admin: false,
    agent_status: body.agentStatus ?? body.agent_status ?? "active",
    elo_rating: typeof body.elo === "number" ? body.elo : 1000,
    gross_revenue: typeof body.revenue === "number" ? body.revenue : 0,
    newsletter_subscribed: !!body.newsletterSubscribed,
  };

  const { data, error } = await sb
    .from("profiles")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("[agents/admin POST]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, agent: data });
}

// PATCH — update an existing agent (any subset of fields)
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Build patch object — only include fields the caller sent. Allow camelCase
  // OR snake_case so the management form doesn't have to know DB column names.
  const map: Record<string, string> = {
    agentName: "agent_name",
    businessName: "business_name",
    ownerName: "name",
    name: "name",
    email: "email",
    phone: "phone",
    role: "role",
    tier: "tier",
    crmStatus: "crm_status",
    crm_status: "crm_status",
    leadScore: "lead_score",
    lead_score: "lead_score",
    isPremium: "is_premium",
    is_premium: "is_premium",
    agentStatus: "agent_status",
    agent_status: "agent_status",
    elo: "elo_rating",
    elo_rating: "elo_rating",
    revenue: "gross_revenue",
    gross_revenue: "gross_revenue",
    newsletterSubscribed: "newsletter_subscribed",
    newsletter_subscribed: "newsletter_subscribed",
    // Editable arena card overrides
    arenaValueOverride: "arena_value_override",
    arena_value_override: "arena_value_override",
    arenaReachOverride: "arena_reach_override",
    arena_reach_override: "arena_reach_override",
    arenaRating: "arena_rating",
    arena_rating: "arena_rating",
    website: "website",
  };
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "id" || v === undefined) continue;
    const col = map[k] ?? k;
    update[col] = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[agents/admin PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, agent: data });
}

// GET — fetch full profile (including confidential fields) by id
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[agents/admin GET]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ agent: data });
}
