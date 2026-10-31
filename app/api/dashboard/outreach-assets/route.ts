import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";
import { verifyOmniToken } from "@/lib/server/omni-session-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/outreach-assets?business_id=<uuid>|all
 *
 * Status counts for `omni_outreach_assets` — the outreach assets a
 * workspace has produced, grouped by status (draft / scheduled / sent /
 * opened / replied / bounced).
 *
 * This route exists because the dashboard used to read the table
 * directly from the browser with the anon key. `omni_outreach_assets` is
 * RLS-locked to `service_role`, so that read answered 200 with an empty
 * array: the analytics page reported "0 assets, 0 sent, 0 opened,
 * 0 replied" for a workspace that had sent outreach, and reported the
 * zeros as if they were results. The same shape as the leads table,
 * which was fixed earlier by /api/dashboard/leads.
 *
 * Auth and authorization mirror /api/dashboard/leads:
 *   - bearer omni_token (base64 JSON with `sub` + optional `exp`), OR
 *   - Supabase cookie session.
 *   - Platform admin/owner -> any workspace, and `all`.
 *   - Per-brand user (via the omni_business_users mapping) -> only their
 *     mapped business_id. Asking for `all` requires platform admin.
 *
 * Counts are aggregated server-side so the payload stays small: the page
 * needs the number per status, not the rows.
 */

const ROW_LIMIT = 10000;

type AssetStatusRow = { status?: string | null };

function unavailable(reason: string, error: unknown) {
  console.error(`[dashboard/outreach-assets] ${reason}:`, error);
  return NextResponse.json(
    { error: "Dashboard data unavailable", reason },
    { status: 503 },
  );
}

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const payload = verifyOmniToken(bearer);
      if (payload) return payload.sub;
    }
  } catch {
    /* fall through */
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* read-only */
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

function countByStatus(rows: AssetStatusRow[]) {
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    const status = (row.status || "unknown").toString();
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return byStatus;
}

export async function GET(req: Request) {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const bizParam = url.searchParams.get("business_id");
  const sb = createAdminClient();

  const callerIsCanonicalMafi = hasPlatformDashboardAccess({ id: callerId });
  const { data: profile } = callerIsCanonicalMafi
    ? { data: { id: callerId, role: "admin", is_admin: true } }
    : await sb
        .from("profiles")
        .select("id, email, username, name, role, is_admin")
        .eq("id", callerId)
        .single();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isPlatformAdmin = hasPlatformDashboardAccess(profile);

  let query = sb.from("omni_outreach_assets").select("status");

  if (!bizParam || bizParam === "all") {
    // Cross-tenant — platform-admin only.
    if (!isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden — platform admin required for cross-tenant assets" },
        { status: 403 },
      );
    }
  } else {
    // Single workspace — admin OR mapped via omni_business_users.
    if (!isPlatformAdmin) {
      const { data: membership } = await sb
        .from("omni_business_users")
        .select("id")
        .eq("business_id", bizParam)
        .eq("user_id", callerId)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden — not a member of this workspace" },
          { status: 403 },
        );
      }
    }
    query = query.eq("business_id", bizParam);
  }

  const { data, error } = await query.limit(ROW_LIMIT);
  if (error) {
    return unavailable("assets_lookup_failed", error);
  }

  const rows = (data ?? []) as AssetStatusRow[];
  const byStatus = countByStatus(rows);

  return NextResponse.json({
    byStatus,
    total: rows.length,
    // True when the table holds more rows than one response carries, so
    // the dashboard can say so instead of presenting a partial total as
    // the whole truth.
    truncated: rows.length >= ROW_LIMIT,
  });
}
