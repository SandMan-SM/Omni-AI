// Platform stats — row counts across the agentic + legacy tables. Used
// by the Agentic Assets console to show platform-health at a glance.

import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { authorizeCronOrAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// The SERVICE ROLE, not the anon key.
//
// Every `omni_*` table below is RLS-locked to `service_role`, so an anon
// count answers 200 with `count: 0` and no error — the console showed
// "0 leads, 0 businesses, 0 activity" on a platform holding 490 leads
// and 24 businesses, and reported the zeros as if they were results.
//
// The route is gated by `authorizeCronOrAdmin` above the query, so the
// privileged client is only reachable by an operator. The table name is
// dynamic, which is also why the static RLS gate cannot prove this by
// reading the table name: `npm run audit:rls` now flags a non-admin
// client with a dynamic table name for exactly this reason.
const sb = createAdminClient();

const TABLES = [
  // Agentic
  { name: "omni_businesses",                label: "Businesses",            group: "core" },
  { name: "omni_leads_generated",           label: "Leads",                 group: "core" },
  { name: "omni_meeting_bookings",          label: "Meetings",              group: "core" },
  { name: "omni_lead_email_aliases",        label: "Email aliases",         group: "core" },
  { name: "omni_lead_status_history",       label: "Status transitions",    group: "history" },
  { name: "omni_lead_activity",             label: "Lead activity events",  group: "history" },
  { name: "omni_business_advancement_snapshots", label: "Advancement snapshots", group: "history" },
  { name: "omni_admin_audit_log",           label: "Admin audit events",    group: "history" },
  { name: "omni_hot_lead_alerts",           label: "Hot-lead alerts fired", group: "history" },
  { name: "omni_coach_recommendations",     label: "Coach recommendations", group: "ai" },
  { name: "omni_company_intel",             label: "Apollo enrichments",    group: "ai" },
  { name: "omni_outreach_assets",           label: "Outreach assets",       group: "ai" },
  { name: "omni_lead_campaigns",            label: "Campaigns",             group: "ai" },
  // Legacy
  { name: "profiles",                       label: "Profiles (legacy)",     group: "legacy" },
  { name: "demo_bookings",                  label: "Demo bookings",         group: "legacy" },
  { name: "newsletter_subscriptions",       label: "Newsletter subs",       group: "legacy" },
  { name: "newsletter_posts",               label: "Newsletter posts",      group: "legacy" },
  { name: "newsletter_sends",               label: "Newsletter sends",      group: "legacy" },
];

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Even row counts are signal — they let an attacker
  // measure tenant volume + fingerprint outreach activity.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const counts = await Promise.all(
    TABLES.map(async t => {
      try {
        const { count, error } = await sb.from(t.name).select("*", { count: "exact", head: true });
        if (error) return { ...t, count: null, error: error.message };
        return { ...t, count: count ?? 0, error: null };
      } catch (e) {
        return { ...t, count: null, error: e instanceof Error ? e.message : "unknown" };
      }
    })
  );

  // Group + total
  const groups: Record<string, typeof counts> = {};
  for (const c of counts) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }
  const total = counts.reduce((s, c) => s + (c.count ?? 0), 0);

  return NextResponse.json({
    total_rows: total,
    groups,
    fetched_at: new Date().toISOString(),
  });
}
