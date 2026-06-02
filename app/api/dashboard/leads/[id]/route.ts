import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";

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

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) {
        return payload.sub;
      }
    }
  } catch {
    /* fall through */
  }
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* read-only */
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// Shared admin/membership gate. Returns `{ ok: true, leadBizId, isAdmin }`
// or a Response with the right error code.
async function gate(
  id: string,
): Promise<
  | { ok: true; lead: { id: string; business_id: string }; isAdmin: boolean }
  | { ok: false; res: NextResponse }
> {
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const sb = createAdminClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", callerId)
    .single();
  if (!profile) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const profileRow = profile as { role?: unknown; is_admin?: unknown };
  const isAdmin =
    profileRow.is_admin === true ||
    (typeof profileRow.role === "string" &&
      ["admin", "owner", "platform"].includes(
        (profileRow.role || "").toLowerCase(),
      ));
  const { data: lead } = await sb
    .from("omni_leads_generated")
    .select("id, business_id")
    .eq("id", id)
    .maybeSingle();
  if (!lead) {
    return { ok: false, res: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };
  }
  const leadRow = lead as { id: string; business_id: string };
  if (!isAdmin) {
    const { data: membership } = await sb
      .from("omni_business_users")
      .select("id")
      .eq("business_id", leadRow.business_id)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!membership) {
      return {
        ok: false,
        res: NextResponse.json({ error: "Forbidden — not a member of this workspace" }, { status: 403 }),
      };
    }
  }
  return { ok: true, lead: leadRow, isAdmin };
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
