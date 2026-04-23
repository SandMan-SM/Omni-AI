import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns
 *
 * Previously: trusted a client-supplied `?is_admin=true` query param as the
 * entire authorization model. Any curl could pass it and get every row from
 * `campaigns`. Worse, `?profile_id=<uuid>` was trusted verbatim — classic
 * IDOR: swap in another user's profile id, read their campaigns.
 *
 * Now:
 *   1. Try `requireAdmin()` — if the caller is a real admin (verified by
 *      server, not by URL), return every campaign. The old `is_admin` query
 *      param is ignored entirely.
 *   2. Otherwise, resolve the caller's identity from the Supabase cookie
 *      session. Return only their own campaigns. Any client-supplied
 *      `profile_id` is ignored.
 *   3. No admin token and no cookie session → 401.
 *
 * Dashboard callers should pass the omni_token bearer (the dashboard page
 * now does). Cookie-session callers (legacy SSR flows) continue to work.
 */
export async function GET() {
  const sb = createAdminClient();

  // ── 1. Admin short-circuit ────────────────────────────────────────────
  const adminAuth = await requireAdmin();
  if (!('error' in adminAuth) || !adminAuth.error) {
    const { data, error } = await sb
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error('[api/campaigns] admin query error:', error);
      return NextResponse.json(
        { error: "We couldn't load campaigns. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ campaigns: data || [] });
  }

  // ── 2. Authenticated user → own campaigns only ────────────────────────
  // Accept either a Supabase cookie session OR the same omni_token bearer
  // format used by requireAdmin, so dashboard clients (which mint an
  // omni_token into localStorage) don't have to also carry a cookie.
  let callerProfileId: string | null = null;

  // Try bearer first
  try {
    const hdrs = await headers();
    const bearer = (hdrs.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      const json = Buffer.from(bearer, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      if (payload?.sub && (typeof payload.exp !== 'number' || payload.exp >= Date.now())) {
        callerProfileId = String(payload.sub);
      }
    }
  } catch {
    /* fall through to cookie */
  }

  // Fall back to Supabase cookie session
  if (!callerProfileId) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() { /* read-only */ },
          },
        },
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) callerProfileId = user.id;
    } catch {
      /* no session */
    }
  }

  if (!callerProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await sb
    .from("campaigns")
    .select("*")
    .eq("profile_id", callerProfileId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error('[api/campaigns] user query error:', error);
    return NextResponse.json(
      { error: "We couldn't load campaigns. Please try again." },
      { status: 500 },
    );
  }
  return NextResponse.json({ campaigns: data || [] });
}
