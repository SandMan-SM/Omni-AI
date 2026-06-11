import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/businesses
 *
 * Returns the workspaces (omni_businesses rows) the caller can see.
 * Platform admin/owner → every business. Per-brand user → only the
 * business_ids in their omni_business_users mapping.
 *
 * This exists because omni_businesses has a service_role_all RLS
 * policy, so the browser anon client gets zero rows. Dashboard pages
 * previously fetched it directly and silently saw an empty workspace
 * list — selectedBiz never resolved and leads never loaded.
 *
 * Auth mirrors /api/dashboard/leads.
 */

/**
 * Live Better consolidation (2026-05-19) — Sita asked twice for the
 * workspace dropdown to (a) drop the empty "On The Drip" row and (b)
 * stop calling the remaining row "Prime IV Hydration". The actual
 * client behind the prime_iv tenancy is Jaime's "Live Better On The
 * Drip" personal-brand podcast — livebetteronthedrip.com writes every
 * lead and event into inbound_prime_iv_*. Renaming the row in
 * omni_businesses requires SQL (RLS-locked, can't be done from this
 * Node process autonomously per the CLAUDE.md "don't run migrations
 * autonomously" rule), so we apply the rename + filter at API
 * response time as a stop-gap. Once Sita runs the matching SQL —
 *
 *   UPDATE omni_businesses
 *      SET name = 'Live Better',
 *          website = 'livebetteronthedrip.com',
 *          ga4_measurement_id = 'G-6JZP5C4NMQ'
 *    WHERE slug = 'prime_iv';
 *   DELETE FROM omni_businesses WHERE slug = 'otd';
 *
 * — this override becomes a no-op and can be removed.
 */
type BusinessRow = {
  slug?: unknown;
  name?: unknown;
  website?: unknown;
  ga4_measurement_id?: unknown;
  display_order?: unknown;
  [key: string]: unknown;
};

const BUSINESS_SELECT = [
  "id",
  "name",
  "slug",
  "industry",
  "location",
  "website",
  "plan",
  "contact_email",
  "partnership_blurb",
  "brand_logo_url",
  "ga4_measurement_id",
  "created_at",
  "display_order",
].join(",");

function sortBusinesses(rows: BusinessRow[]): BusinessRow[] {
  return [...rows].sort((a, b) => {
    const aOrder = typeof a.display_order === "number" ? a.display_order : Number.POSITIVE_INFINITY;
    const bOrder = typeof b.display_order === "number" ? b.display_order : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

function applyLiveBetterOverrides(rows: BusinessRow[]): BusinessRow[] {
  return sortBusinesses(rows)
    .filter((row) => row?.slug !== "otd")
    .map((row) => {
      if (row?.slug !== "prime_iv") return row;
      const websiteRaw =
        typeof row.website === "string" ? row.website.trim() : "";
      const ga4Raw =
        typeof row.ga4_measurement_id === "string"
          ? row.ga4_measurement_id.trim()
          : "";
      return {
        ...row,
        name: "Live Better",
        website: websiteRaw || "livebetteronthedrip.com",
        ga4_measurement_id: ga4Raw || "G-6JZP5C4NMQ",
      };
    });
}

function dashboardDataUnavailable(reason: string, error: unknown) {
  console.error(`[dashboard/businesses] ${reason}:`, error);
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

export async function GET() {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (isPlatformAdmin) {
    const { data, error } = await sb
      .from("omni_businesses")
      .select(BUSINESS_SELECT)
      // Avoid database-side sorting here. Production PostgREST has returned
      // statement timeouts on ordered omni_businesses reads, which blocks the
      // whole dashboard before leads can load. This route fetches a tiny
      // workspace list and sorts it in process instead.
      .limit(100);
    if (error) {
      return dashboardDataUnavailable("businesses_lookup_failed", error);
    }
    return NextResponse.json({
      businesses: applyLiveBetterOverrides((data ?? []) as unknown as BusinessRow[]),
      isAdmin: true,
    });
  }

  // Per-brand: resolve mappings → return only those businesses.
  const { data: mappings, error: mapErr } = await sb
    .from("omni_business_users")
    .select("business_id")
    .eq("user_id", callerId);
  if (mapErr) {
    return dashboardDataUnavailable("business_membership_lookup_failed", mapErr);
  }
  const ids = (mappings ?? [])
    .map((m: { business_id?: unknown }) =>
      typeof m.business_id === "string" ? m.business_id : null,
    )
    .filter((x): x is string => !!x);
  if (ids.length === 0) {
    return NextResponse.json({ businesses: [], isAdmin: false });
  }
  const { data, error } = await sb
    .from("omni_businesses")
    .select(BUSINESS_SELECT)
    .in("id", ids)
    .limit(100);
  if (error) {
    return dashboardDataUnavailable("businesses_lookup_failed", error);
  }
  return NextResponse.json({
    businesses: applyLiveBetterOverrides((data ?? []) as unknown as BusinessRow[]),
    isAdmin: false,
  });
}
