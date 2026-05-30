import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * POST /api/dashboard/businesses/ga4
 *
 * Updates the GA4 measurement ID for a single business. Admin-only
 * (same gate as /api/dashboard/businesses → `isAdmin` branch).
 *
 * Body: { business_id: string, ga4_measurement_id: string | null }
 *
 * The measurement ID is loosely validated against `^G-[A-Z0-9]{6,12}$`.
 * Passing null or an empty string clears the column. Either way the
 * dashboard refreshes its dropdown via /api/dashboard/businesses to
 * pick up the new value.
 *
 * Mirrors the auth dance used in /api/dashboard/businesses (bearer
 * omni_token first, supabase cookie session second) so existing
 * dashboard call sites work without extra wiring.
 */

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

export async function POST(request: Request) {
  noStore();

  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { business_id?: unknown; ga4_measurement_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const businessId =
    typeof body.business_id === "string" ? body.business_id : null;
  if (!businessId) {
    return NextResponse.json({ error: "business_id required" }, { status: 400 });
  }

  // Normalize: empty string + null both clear the column. Otherwise
  // validate the measurement-ID shape — GA4 IDs are always "G-" plus
  // 6–12 uppercase-alphanumeric characters today. Reject anything
  // else so we don't silently store typos that'd never fire.
  const raw = body.ga4_measurement_id;
  const trimmed =
    typeof raw === "string" ? raw.trim().toUpperCase() : null;
  let ga4: string | null = null;
  if (trimmed && trimmed.length > 0) {
    if (!/^G-[A-Z0-9]{6,12}$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid GA4 measurement ID (expected G-XXXXXXXX)" },
        { status: 400 },
      );
    }
    ga4 = trimmed;
  }

  const { error } = await sb
    .from("omni_businesses")
    .update({ ga4_measurement_id: ga4 })
    .eq("id", businessId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ga4_measurement_id: ga4 });
}
