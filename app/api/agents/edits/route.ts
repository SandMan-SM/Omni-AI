import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Agent edit history. Previously unauthenticated — anonymous callers could
 * read the agency's whole edit log (project names, commit messages, files
 * changed), which is reconnaissance for anyone mapping the client roster.
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
      .from("agent_edits")
      .select("id, project, commit_message, category, lines_added, files_changed, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
