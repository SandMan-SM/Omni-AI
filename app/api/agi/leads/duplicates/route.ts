// Lead duplicate audit — reads omni_lead_duplicates view + offers a merge
// endpoint that consolidates duplicate rows into one canonical lead.

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

// GET — list duplicate groups for a single business. Previously returned
// duplicates across ALL tenants (no business_id filter), so a client-
// viewer hitting this endpoint saw rows from every workspace. Filter by
// business_id when supplied; reject without it to avoid the leak.
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }
  const { data, error } = await sb
    .from("omni_lead_duplicates")
    .select("*")
    .eq("business_id", business_id)
    .limit(100);
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

  // Fetch the keeper to get business_id + existing notes
  const { data: keeper } = await sb
    .from("omni_leads_generated")
    .select("id, business_id, email, score, status, notes")
    .eq("id", keep_id)
    .single();
  if (!keeper) return NextResponse.json({ error: "keep_id not found" }, { status: 404 });

  // Fetch all to-merge rows. Filter by business_id below so a caller can't
  // sneak in IDs from a different tenant — the hard-delete that follows
  // would otherwise silently drop cross-tenant rows on RLS-relaxed deploys.
  const { data: dupes } = await sb
    .from("omni_leads_generated")
    .select("id, business_id, email, score, status, notes")
    .in("id", merge_ids);

  const sameTenantDupes = (dupes ?? []).filter(d => d.business_id === keeper.business_id);
  if (sameTenantDupes.length === 0) {
    return NextResponse.json({ error: "No mergeable duplicates in same business" }, { status: 400 });
  }

  let aliasInserts = 0;
  let merged = 0;
  let highestScore = keeper.score ?? 0;
  const mergedNotes: string[] = [];

  for (const d of sameTenantDupes) {
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
    // Preserve the duplicate's operator-curated notes — the row is about
    // to be hard-deleted, so any manual context (call recap, internal
    // priority) goes with it unless we move it onto the keeper.
    if (d.notes && d.notes.trim()) {
      mergedNotes.push(`[merged from ${d.email ?? d.id}]\n${d.notes.trim()}`);
    }
    merged++;
  }

  // Compose the keeper's new notes — original first, merged context below.
  const combinedNotes = [keeper.notes?.trim(), ...mergedNotes]
    .filter(Boolean)
    .join('\n\n') || null;

  // Update keeper with merged signals
  await sb
    .from("omni_leads_generated")
    .update({
      score: highestScore,
      notes: combinedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", keep_id);

  // Hard delete only the same-tenant duplicates we actually merged. The
  // alias rows already preserve the emails; the notes were lifted onto
  // the keeper above.
  const safeIds = sameTenantDupes.map(d => d.id);
  const { error: delErr } = await sb
    .from("omni_leads_generated")
    .delete()
    .in("id", safeIds);
  if (delErr) {
    console.error("[leads/duplicates merge] delete failed:", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, merged, alias_inserts: aliasInserts, kept: keep_id });
}
