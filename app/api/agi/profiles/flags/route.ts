// Lightweight read-only endpoint that surfaces the sponsor + username flags
// for a batch of profile ids — used by /dashboard/leads to decorate
// profile-backed lead rows with a SPONSOR badge + show usernames in the
// detail panel.
//
// Auth: requireAdmin() — same gate the rest of the agentic surfaces use.

import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  noStore();
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) return NextResponse.json({ flags: [] });

  // Validate as UUIDs to keep the IN clause safe
  const ids = idsParam
    .split(",")
    .map(s => s.trim())
    .filter(s => /^[0-9a-f-]{36}$/i.test(s));

  if (ids.length === 0) return NextResponse.json({ flags: [] });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, is_sponsor, sponsor_tier, agent_name, first_name, name")
    .in("id", ids);

  if (error) {
    console.error("[agi/profiles/flags GET]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ flags: data ?? [] });
}
