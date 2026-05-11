import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/leads?business_id=<uuid>|all
 *
 * Returns omni_leads_generated rows for the requested workspace,
 * sorted by created_at desc. This route exists because the leads
 * table is locked down by an RLS policy that only grants
 * service_role SELECT — the dashboard previously queried it
 * directly from the browser via the anon Supabase client and
 * silently got back zero rows on every request (102 CPS leads,
 * 101 Leifson leads, etc. were all in the DB but invisible to the
 * dashboard).
 *
 * Auth mirrors /api/dashboard/inbound/[slug]:
 *   - bearer omni_token (base64 JSON with `sub` + optional `exp`), OR
 *   - Supabase cookie session.
 *
 * Authorization:
 *   - Platform admin/owner → any workspace.
 *   - Per-brand user (via omni_business_users mapping) → only their
 *     mapped business_id. Asking for a workspace they're not mapped
 *     to returns 403. Asking for `all` (cross-tenant view) requires
 *     platform-admin.
 */

const PAGE_LIMIT_DEFAULT = 1000;

async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const json = Buffer.from(bearer, "base64").toString("utf8");
      const payload = JSON.parse(json) as { sub?: unknown; exp?: unknown };
      if (
        payload &&
        typeof payload.sub === "string" &&
        (typeof payload.exp !== "number" || payload.exp >= Date.now())
      ) {
        return payload.sub;
      }
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

export async function GET(req: Request) {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const bizParam = url.searchParams.get("business_id");
  const pipelineParam = url.searchParams.get("pipeline_type");
  const orderByParam = url.searchParams.get("order_by");
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 5000
      ? Math.floor(limitParam)
      : PAGE_LIMIT_DEFAULT;

  // Only allow a small allowlist of order_by columns — avoids the
  // caller injecting an arbitrary column name into the PostgREST
  // .order() call.
  const orderColumn =
    orderByParam === "score" ? "score" : "created_at";
  // pipeline_type filter: leads | sponsor | affiliate | sales | <any string>.
  // We accept anything but trim to be safe; PostgREST .eq() will just
  // return zero rows for an unknown value, which is the right behavior.
  const pipelineType = pipelineParam ? pipelineParam.trim() : null;

  const sb = createAdminClient();

  // Resolve caller profile + admin gate.
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", callerId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profileRow = profile as { role?: unknown; is_admin?: unknown };
  const isPlatformAdmin =
    profileRow.is_admin === true ||
    (typeof profileRow.role === "string" &&
      ["admin", "owner", "platform"].includes(
        (profileRow.role || "").toLowerCase(),
      ));

  // Authorization branches.
  if (!bizParam || bizParam === "all") {
    // Cross-tenant — platform-admin only.
    if (!isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden — platform admin required for cross-tenant leads" },
        { status: 403 },
      );
    }
    let q = sb.from("omni_leads_generated").select("*");
    if (pipelineType) q = q.eq("pipeline_type", pipelineType);
    const { data, error } = await q
      .order(orderColumn, { ascending: false })
      .limit(limit);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ leads: data ?? [] });
  }

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

  const { data, error } = await sb
    .from("omni_leads_generated")
    .select("*")
    .eq("business_id", bizParam)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ leads: data ?? [] });
}
