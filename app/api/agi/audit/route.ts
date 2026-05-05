// Admin audit log — read recent owner-level events. Writes happen
// automatically from server-side actions (cron tasks, API endpoints
// that mutate state) via direct insert.

import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

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
  const rawLimit = Number(searchParams.get("limit") ?? 30);
  const limit = Math.min(100, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 30);
  const action = searchParams.get("action");

  let q = sb.from("omni_admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  if (error) {
    console.error("[audit GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}

// POST — append an audit event manually (e.g. from a cron task)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, target_type, target_id, metadata, actor } = body;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const { data, error } = await sb
    .from("omni_admin_audit_log")
    .insert({
      actor: actor ?? "api",
      action,
      target_type: target_type ?? null,
      target_id: target_id ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error("[audit POST]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, event: data });
}
