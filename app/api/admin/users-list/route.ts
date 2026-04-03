import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/users-list — return all profiles for admin overview (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}
