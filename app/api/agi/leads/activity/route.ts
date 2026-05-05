// Per-lead activity log — read + append events on a lead (calls, emails,
// notes, custom). Uses the existing omni_lead_activity table with
// event_type / event_subtype / details(jsonb) shape.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// GET ?lead_id=… returns all activity rows desc
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. lead_id is a UUID — guessable enough that without auth
  // anyone could iterate IDs and read every tenant's activity history.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("omni_lead_activity")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[leads/activity GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ activity: data ?? [] });
}

// POST { lead_id, event_type, event_subtype?, details? } appends a row.
// Used by the lead detail panel's quick-action buttons (log call, log email,
// add note) and by automated systems that record events.
export async function POST(req: NextRequest) {
  // Auth-gate. POST appends arbitrary event_type / details to any lead's
  // activity log; the per-business feed picks up business_id from the
  // lead row, so an attacker could spam fake "call_completed" events
  // into another tenant's feed and pollute coach/report-card output.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { lead_id, event_type, event_subtype, details } = body as {
    lead_id?: string;
    event_type?: string;
    event_subtype?: string;
    details?: Record<string, unknown> | string;
  };
  if (!lead_id || !event_type) {
    return NextResponse.json({ error: "lead_id + event_type required" }, { status: 400 });
  }

  // Look up business_id from the lead so it can join the per-business
  // activity feed.
  const { data: lead } = await sb
    .from("omni_leads_generated")
    .select("business_id")
    .eq("id", lead_id)
    .single();

  const detailsJson = typeof details === "string"
    ? { note: details }
    : (details ?? {});

  const { data, error } = await sb
    .from("omni_lead_activity")
    .insert({
      lead_id,
      business_id: lead?.business_id ?? null,
      event_type,
      event_subtype: event_subtype ?? null,
      details: detailsJson,
    })
    .select()
    .single();

  if (error) {
    console.error("[leads/activity POST]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, activity: data });
}
