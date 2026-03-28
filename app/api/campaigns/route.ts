import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/campaigns?profile_id=xxx&is_admin=true
// Admin: returns all campaigns
// Regular user: returns only their campaigns
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const isAdmin = req.nextUrl.searchParams.get("is_admin") === "true";

  let query = sb
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: true });

  if (!isAdmin && profileId) {
    query = query.eq("profile_id", profileId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data || [] });
}
