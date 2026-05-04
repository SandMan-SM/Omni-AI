// Lead status history — chronological list of every status transition for
// a given lead. Used by the lead detail panel timeline.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("omni_lead_status_history")
    .select("id, from_status, to_status, changed_at, note")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: true });

  if (error) {
    console.error("[leads/history]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ history: data ?? [] });
}
