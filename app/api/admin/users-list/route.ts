import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serverErrorResponse } from "@/lib/api-errors";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


// GET /api/admin/users-list — return all profiles for admin overview (admin only)
export async function GET() {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Previously returned `error.message` — that leaked Postgres schema detail
  // (table / column / constraint names) to anyone with a valid admin session.
  // Full error is in the Vercel logs under the [admin/users-list.GET] tag.
  if (error) return serverErrorResponse("admin/users-list.GET", error);
  return NextResponse.json({ users: data || [] });
}
