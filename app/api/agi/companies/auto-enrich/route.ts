// Auto-enrichment scanner — finds leads with a company set but no
// matching omni_company_intel row, returns them so the dashboard can
// queue Apollo enrichment in batches. Doesn't call Apollo itself
// (that's handled client-side via MCP); it just identifies candidates.

import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Without business_id this enumerates leads + enriched
  // companies across every tenant. With business_id but no auth, an
  // attacker can pull a tenant's prospect list (lead PII) by simply
  // guessing the tenant id.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  const rawLimit = Number(searchParams.get("limit") ?? 20);
  const limit = Math.min(50, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20);

  // Pull leads with a company set + already-enriched companies for this biz
  let leadsQ = sb
    .from("omni_leads_generated")
    .select("id, business_id, company")
    .not("company", "is", null)
    .neq("company", "")
    .limit(200);
  if (businessId) leadsQ = leadsQ.eq("business_id", businessId);

  const [{ data: leads }, { data: enriched }] = await Promise.all([
    leadsQ,
    sb.from("omni_company_intel").select("name, business_id"),
  ]);

  // Build a set of (business_id, lower(company-name)) pairs that are already enriched
  const enrichedSet = new Set(
    (enriched ?? []).map(e => `${e.business_id}::${(e.name ?? "").toLowerCase().trim()}`)
  );

  // Group lead companies and skip ones already enriched
  const candidates: { business_id: string; company: string; lead_count: number; lead_ids: string[] }[] = [];
  const groups = new Map<string, { business_id: string; company: string; lead_ids: string[] }>();

  for (const l of leads ?? []) {
    const key = `${l.business_id}::${(l.company ?? "").toLowerCase().trim()}`;
    if (enrichedSet.has(key)) continue;
    if (!groups.has(key)) {
      groups.set(key, { business_id: l.business_id, company: l.company!, lead_ids: [] });
    }
    groups.get(key)!.lead_ids.push(l.id);
  }

  groups.forEach(g => {
    if (candidates.length >= limit) return;
    candidates.push({ ...g, lead_count: g.lead_ids.length });
  });

  return NextResponse.json({
    queued: candidates.length,
    total_leads_with_companies: (leads ?? []).length,
    already_enriched: enrichedSet.size,
    candidates,
  });
}
