import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * Council Codex — the active operator directives plus the acknowledgement
 * thread, for the Mafi admin view.
 *
 * WHY THIS ROUTE EXISTS
 *
 * Same reason as `/api/dashboard/federation`: the read used to live inside
 * a SERVER component (`app/dashboard/council/page.tsx`), the middleware has
 * no protected routes, and the document request carried no credential — so
 * `GET /dashboard/council` answered 200 to anyone with the URL. The page
 * is explicitly labelled operator-only ("Mafi admin · council") and the
 * file's own comment says `/dashboard/*` is "the only namespace where
 * personal names from upstream may appear".
 *
 * NOTE ON THE CODEX ITSELF: the directive list is DELIBERATELY public —
 * `/api/council/codex` is an unauthenticated, CORS-open endpoint that any
 * agent runtime consults on every reasoning cycle. That is a design choice
 * and it is not changed here. What this route protects is the
 * acknowledgement thread and the fact that this namespace is operator-only
 * in the first place; the client fetch is what makes the page's "operator
 * only" label true instead of decorative.
 */

type Directive = {
  slug: string;
  title: string;
  body_md: string;
  severity: string;
  issued_by: string;
  version: number;
  updated_at: string;
};

type DialogueRow = {
  id: string;
  message_md: string;
  status: string;
  created_at: string | null;
  council_agents: { name: string; archetype_tier: string } | null;
};

export async function GET() {
  noStore();

  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const sb = createAdminClient();
  const [{ data: directives }, { data: dialogues }] = await Promise.all([
    sb
      .from("council_directives")
      .select("slug, title, body_md, severity, issued_by, version, updated_at")
      .eq("status", "active")
      .order("severity", { ascending: true }),
    sb
      .from("pantheon_dialogue")
      .select("id, message_md, status, created_at, council_agents:from_agent_id (name, archetype_tier)")
      .eq("topic", "council_directives_acknowledged_2026_05_08")
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  return NextResponse.json(
    {
      directives: (directives || []) as Directive[],
      dialogues: (dialogues || []) as unknown as DialogueRow[],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
