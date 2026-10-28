import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOmniToken } from "@/lib/server/omni-session-token";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";

/**
 * Shared access gate for the dashboard's per-lead routes.
 *
 * Every `omni_*` table the dashboard touches has a `service_role_all` RLS
 * policy, so the browser can never read or write them directly — a
 * direct `supabase.from(...)` from the client silently no-ops (no error,
 * no row change). The dashboard therefore goes through server routes that
 * run on the service-role client, and those routes have to do the
 * tenancy check themselves, because the service role bypasses RLS.
 *
 * The rule: a platform admin may touch anything; a per-brand user may
 * only touch rows whose `business_id` is in their `omni_business_users`
 * mapping.
 */

export async function resolveCallerProfileId(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const payload = verifyOmniToken(bearer);
      if (payload) {
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

export type LeadAccess =
  | { ok: true; lead: { id: string; business_id: string }; isAdmin: boolean }
  | { ok: false; status: number; error: string };

/**
 * Load the caller's profile row and decide whether they are a platform
 * admin. `hasPlatformDashboardAccess` is the single source of truth for
 * that rule (it also recognises $Mafi's canonical identities even when
 * the profiles row is missing a stale `is_admin` flag).
 */
async function loadCallerProfile(
  callerId: string,
): Promise<{ profile: Record<string, unknown> | null; isAdmin: boolean }> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("profiles")
    .select("id, email, username, name, role, is_admin")
    .eq("id", callerId)
    .maybeSingle();
  if (!data) return { profile: null, isAdmin: false };
  return {
    profile: data as Record<string, unknown>,
    isAdmin: hasPlatformDashboardAccess(data as never),
  };
}

/**
 * Resolve the caller and check they may touch this lead's business.
 * Returns the business_id so callers can scope their own queries.
 */
export async function gateLeadAccess(id: string): Promise<LeadAccess> {
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const sb = createAdminClient();
  const { profile, isAdmin } = await loadCallerProfile(callerId);
  if (!profile) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const { data: lead } = await sb
    .from("omni_leads_generated")
    .select("id, business_id")
    .eq("id", id)
    .maybeSingle();
  if (!lead) {
    return { ok: false, status: 404, error: "Lead not found" };
  }
  const leadRow = lead as { id: string; business_id: string };
  if (!isAdmin) {
    const { data: membership } = await sb
      .from("omni_business_users")
      .select("id")
      .eq("business_id", leadRow.business_id)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!membership) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden — not a member of this workspace",
      };
    }
  }
  return { ok: true, lead: leadRow, isAdmin };
}

/**
 * Resolve the caller and check they may touch this business.
 */
export async function gateBusinessAccess(businessId: string): Promise<
  | { ok: true; business: { id: string }; isAdmin: boolean }
  | { ok: false; status: number; error: string }
> {
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const sb = createAdminClient();
  const { profile, isAdmin } = await loadCallerProfile(callerId);
  if (!profile) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const { data: business } = await sb
    .from("omni_businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) {
    return { ok: false, status: 404, error: "Business not found" };
  }
  if (!isAdmin) {
    const { data: membership } = await sb
      .from("omni_business_users")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!membership) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden — not a member of this workspace",
      };
    }
  }
  return { ok: true, business: business as { id: string }, isAdmin };
}
