import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/campaigns?business_id=<uuid>|all
 *
 * Returns omni_lead_campaigns rows scoped to the caller's workspaces.
 * Service-role only via the admin client because the table is RLS-
 * locked to service_role (same pattern as omni_leads_generated /
 * omni_businesses — every read from the browser anon client used to
 * return zero rows).
 */

function dashboardDataUnavailable(reason: string, error: unknown) {
  console.error(`[dashboard/campaigns] ${reason}:`, error);
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
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) {
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
  const sb = createAdminClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", callerId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profileRow = profile as { role?: unknown; is_admin?: unknown };
  const isAdmin =
    profileRow.is_admin === true ||
    (typeof profileRow.role === "string" &&
      ["admin", "owner", "platform"].includes(
        (profileRow.role || "").toLowerCase(),
      ));
  if (!bizParam || bizParam === "all") {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden — platform admin required for cross-tenant campaigns" },
        { status: 403 },
      );
    }
    const { data, error } = await sb.from("omni_lead_campaigns").select("*");
    if (error) return dashboardDataUnavailable("campaigns_lookup_failed", error);
    return NextResponse.json({ campaigns: data ?? [] });
  }
  if (!isAdmin) {
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
    .from("omni_lead_campaigns")
    .select("*")
    .eq("business_id", bizParam);
  if (error) return dashboardDataUnavailable("campaigns_lookup_failed", error);
  return NextResponse.json({ campaigns: data ?? [] });
}
