import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Per-project intelligence scores. Previously unauthenticated — anonymous
 * callers could read every project's overall score, findings and
 * recommendations, which is the agency's client roster scored and
 * annotated.
 *
 * Now admin-gated via authorizeCronOrAdmin, matching the sibling
 * commands / deployments / visual-errors routes. The service-role client
 * bypasses RLS, so the gate is what protects the rows.
 */
export async function GET(req: Request) {
  noStore();
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("project_intelligence")
      .select("*")
      .order("overall_score", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
