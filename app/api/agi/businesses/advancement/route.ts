// Per-business advancement KPIs — single read of the omni_business_advancement
// view. Used by the Companies tab + Business Advancement panel.
//
// View columns (defined in migration business_advancement_view_plus_smart_sync):
//   business_id · business_name · plan · industry · location · business_created_at
//   leads_total · leads_open · leads_converted · leads_added_7d · leads_added_30d
//   avg_lead_score · revenue_from_leads · last_lead_activity
//   meetings_total · meetings_upcoming · meetings_completed · meetings_cancelled · next_meeting
//   profiles_count · profiles_revenue · admin_name · admin_email
//   advancement_score (0-100)

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
  // Auth-gate. The advancement view dumps EVERY tenant's KPIs in
  // one read — admin name + email, revenue, meeting counts, plan
  // tier. Single biggest cross-tenant data leak before this gate.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { data, error } = await sb
    .from("omni_business_advancement")
    .select("*")
    .order("advancement_score", { ascending: false })
    .order("business_name");

  if (error) {
    console.error("[businesses/advancement]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ businesses: data ?? [] });
}
