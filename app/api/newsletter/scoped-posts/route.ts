import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/newsletter/scoped-posts?business_id=<uuid>
 *
 * Returns newsletter posts (drafts + published) for a single business,
 * scoped by membership. Used by ClientNewsletterStudio so a per-brand
 * client viewer (Brent → Youngs, Adam → Leifson, Sammy → LTB,
 * CPS-owner → CPS) sees only their own posts and never another tenant's.
 *
 * Authorization rules:
 *   • Platform admin (profiles.is_admin or role in {admin,owner,platform})
 *     may request any business_id.
 *   • Otherwise, the caller must be mapped to the requested business_id
 *     via omni_business_users.
 *   • No bearer / no session → 401.
 *   • Mismatch → 403 (not a member of that brand).
 *
 * Response: { posts: Array<{ id, slug, subject, tier, status, published_at, created_at, updated_at }> }
 */
async function resolveCallerProfileId(): Promise<string | null> {
  // 1. omni_token bearer (matches lib/admin-auth.ts pattern)
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

  // 2. Supabase cookie session
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const callerId = await resolveCallerProfileId();
  if (!callerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const businessId = (url.searchParams.get("business_id") || "").trim();
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json(
      { error: "Missing or malformed business_id" },
      { status: 400 },
    );
  }

  const sb = createAdminClient();

  // Membership check — admins skip; everyone else must be in
  // omni_business_users for the requested business_id.
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

  if (!isPlatformAdmin) {
    const { data: membership } = await sb
      .from("omni_business_users")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", callerId)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden — not a member of this brand" },
        { status: 403 },
      );
    }
  }

  // Fetch the business's posts. Returns drafts + published; the studio
  // sorts by published_at when present, otherwise updated_at, so newest
  // surface first regardless of state.
  const { data: posts, error } = await sb
    .from("newsletter_posts")
    .select(
      "id, slug, subject, tier, status, published_at, created_at, updated_at, business_id",
    )
    .eq("business_id", businessId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch posts", detail: error.message },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ posts: posts || [] });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
