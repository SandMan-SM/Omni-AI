import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateLeadAccess } from "@/lib/server/dashboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET    /api/dashboard/leads/[id] → refetch one lead.
 * PATCH  /api/dashboard/leads/[id] → update deal_stage, deal_value,
 *        status, notes, or score on a single lead.
 *
 * omni_leads_generated has a service_role_all RLS policy, so every
 * direct supabase.from('omni_leads_generated').update(...) from the
 * browser was silently no-oping (no error, no row changes). Pipeline /
 * sponsor / affiliate stage drag-drops and deal-value edits looked
 * like they worked but the DB never updated. This route runs through
 * the service-role admin client.
 *
 * Auth mirrors the parent /api/dashboard/leads route. Per-brand users
 * can only touch leads whose business_id is in their omni_business_users
 * mapping; platform admins can touch any lead.
 */

function dashboardDataUnavailable(reason: string, error: unknown) {
  console.error(`[dashboard/leads/id] ${reason}:`, error);
  return NextResponse.json(
    { error: "Dashboard data unavailable", reason },
    { status: 503 },
  );
}

// Shared admin/membership gate. Returns `{ ok: true, leadBizId, isAdmin }`
// or a Response with the right error code.
async function gate(
  id: string,
): Promise<
  | { ok: true; lead: { id: string; business_id: string }; isAdmin: boolean }
  | { ok: false; res: NextResponse }
> {
  const result = await gateLeadAccess(id);
  if (!result.ok) {
    return {
      ok: false,
      res: NextResponse.json({ error: result.error }, { status: result.status }),
    };
  }
  return { ok: true, lead: result.lead, isAdmin: result.isAdmin };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await ctx.params;
  const g = await gate(id);
  if (!g.ok) return g.res;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("omni_leads_generated")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return dashboardDataUnavailable("lead_lookup_failed", error);
  return NextResponse.json({ lead: data });
}

// Only let the caller patch a small allowlist of columns — keeps the
// endpoint from doubling as an arbitrary table-update surface.
const ALLOWED_PATCH_FIELDS = new Set([
  "deal_stage",
  "deal_value",
  "status",
  "notes",
  "score",
  "ai_recommended_angle",
  "ai_score_reasoning",
  "expected_close_date",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await ctx.params;
  const g = await gate(id);
  if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("omni_leads_generated")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return dashboardDataUnavailable("lead_update_failed", error);
  return NextResponse.json({ lead: data });
}
