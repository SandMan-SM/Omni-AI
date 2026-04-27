// Per-business activity feed — chronological list of recent pipeline events
// (leads, meetings, profile signups). Used by the Business Advancement
// cards' "recent activity" preview.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 10));

  let q = sb.from("omni_business_activity_feed").select("*").order("event_at", { ascending: false }).limit(limit);
  if (businessId) q = q.eq("business_id", businessId);

  const { data, error } = await q;
  if (error) {
    console.error("[businesses/activity]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}
