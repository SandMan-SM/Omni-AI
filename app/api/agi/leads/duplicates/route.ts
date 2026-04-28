// Lead duplicate audit — reads omni_lead_duplicates view + offers a merge
// endpoint that consolidates duplicate rows into one canonical lead.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// GET — list duplicate groups
export async function GET() {
  const { data, error } = await sb.from("omni_lead_duplicates").select("*").limit(100);
  if (error) {
    console.error("[leads/duplicates GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ duplicates: data ?? [] });
}

// POST { keep_id, merge_ids[] } — keeps keep_id, merges others into it.
// Each merged lead's email becomes an alias on the keeper, then deleted.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keep_id, merge_ids } = body as { keep_id?: string; merge_ids?: string[] };
  if (!keep_id || !Array.isArray(merge_ids) || merge_ids.length === 0) {
    return NextResponse.json({ error: "keep_id + merge_ids[] required" }, { status: 400 });
  }

  // Fetch the keeper to get business_id
  const { data: keeper } = await sb
    .from("omni_leads_generated")
    .select("id, business_id, email, score, status")
    .eq("id", keep_id)
    .single();
  if (!keeper) return NextResponse.json({ error: "keep_id not found" }, { status: 404 });

  // Fetch all to-merge rows
  const { data: dupes } = await sb
    .from("omni_leads_generated")
    .select("id, email, score, status, notes")
    .in("id", merge_ids);

  let aliasInserts = 0;
  let merged = 0;
  let highestScore = keeper.score ?? 0;

  for (const d of dupes ?? []) {
    // Add the duplicate's email as an alias on the keeper
    if (d.email && d.email !== keeper.email) {
      await sb.from("omni_lead_email_aliases").upsert({
        primary_lead_id: keep_id,
        business_id: keeper.business_id,
        alias_email: d.email,
      }, { onConflict: "alias_email" });
      aliasInserts++;
    }
    if ((d.score ?? 0) > highestScore) highestScore = d.score ?? 0;
    merged++;
  }

  // Update keeper with merged signals
  await sb
    .from("omni_leads_generated")
    .update({ score: highestScore, updated_at: new Date().toISOString() })
    .eq("id", keep_id);

  // Hard delete the duplicates — alias rows already preserve the emails
  const { error: delErr } = await sb
    .from("omni_leads_generated")
    .delete()
    .in("id", merge_ids);
  if (delErr) {
    console.error("[leads/duplicates merge] delete failed:", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, merged, alias_inserts: aliasInserts, kept: keep_id });
}
