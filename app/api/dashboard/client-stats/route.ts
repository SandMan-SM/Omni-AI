import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/client-stats
 *
 * Per-workspace KPIs for the Interlinked command center: leads,
 * revenue, subscribers, newsletters sent.
 *
 * Why this route exists: the page used to read a `client_registry`
 * table that the live schema does not have (PostgREST answered
 * "Could not find the table 'public.client_registry'"), and a
 * `newsletters` table whose `client_id / revenue / leads /
 * subscribers_count` columns do not exist either. Both reads errored, so
 * the page showed "Failed to load clients" to every super admin and the
 * KPI tiles never held a number.
 *
 * The numbers now come from the tables that DO carry them:
 *   leads       — omni_leads_generated, grouped by business_id
 *   revenue     — profiles.total_spent, grouped by business_id
 *   subscribers — profiles.newsletter_subscribed, grouped by business_id
 *   newsletters — no per-workspace source exists in the schema
 *                 (newsletter_sends carries no business_id), so this is
 *                 reported as 0 rather than invented.
 *
 * Admin-only: these are portfolio-wide numbers, not the caller's own
 * workspace, so there is no per-tenant variant of this route.
 */

function unavailable(reason: string, error: unknown) {
  console.error(`[dashboard/client-stats] ${reason}:`, error);
  return NextResponse.json(
    { error: "Dashboard data unavailable", reason },
    { status: 503 },
  );
}

type ClientStats = {
  revenue: number;
  leads: number;
  subscribers: number;
  newsletters_sent: number;
};

export async function GET() {
  noStore();

  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const sb = createAdminClient();

  const [leadsResult, profilesResult] = await Promise.all([
    sb.from("omni_leads_generated").select("id, business_id, deal_value"),
    sb.from("profiles").select("id, business_id, total_spent, newsletter_subscribed"),
  ]);

  if (leadsResult.error) {
    return unavailable("leads_lookup_failed", leadsResult.error);
  }
  if (profilesResult.error) {
    return unavailable("profiles_lookup_failed", profilesResult.error);
  }

  const byClient: Record<string, ClientStats> = {};
  const slot = (businessId: string): ClientStats => {
    if (!byClient[businessId]) {
      byClient[businessId] = {
        revenue: 0,
        leads: 0,
        subscribers: 0,
        newsletters_sent: 0,
      };
    }
    return byClient[businessId];
  };

  for (const lead of leadsResult.data ?? []) {
    const businessId = (lead.business_id as string | null) ?? "";
    if (!businessId) continue;
    slot(businessId).leads += 1;
  }

  for (const profile of profilesResult.data ?? []) {
    const businessId = (profile.business_id as string | null) ?? "";
    if (!businessId) continue;
    const stats = slot(businessId);
    stats.revenue += Number(profile.total_spent ?? 0);
    if (profile.newsletter_subscribed) stats.subscribers += 1;
  }

  return NextResponse.json({ by_client: byClient });
}
