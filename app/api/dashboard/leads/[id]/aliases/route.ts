import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateLeadAccess } from "@/lib/server/dashboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/leads/[id]/aliases → the alternate emails a lead has
 * been seen under.
 *
 * omni_lead_email_aliases has a service_role_all RLS policy, so the
 * dashboard's direct `supabase.from('omni_lead_email_aliases')` read from
 * the browser always returned [] — the alias list on a lead was silently
 * empty, with no error to explain why. This route runs on the service-role
 * client and applies the same tenancy gate as its sibling lead routes.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  noStore();
  const { id } = await ctx.params;

  const gate = await gateLeadAccess(id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("omni_lead_email_aliases")
    .select("alias_email")
    .eq("primary_lead_id", gate.lead.id)
    .order("alias_email");

  if (error) {
    console.error("[dashboard/leads/id/aliases]", error);
    return NextResponse.json(
      { error: "Dashboard data unavailable" },
      { status: 503 },
    );
  }

  const aliases = (data ?? [])
    .map((r) => r.alias_email as string)
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  return NextResponse.json({ aliases: Array.from(new Set(aliases)) });
}
