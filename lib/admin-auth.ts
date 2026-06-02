import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from './supabase/admin';
import { decodeOmniToken, isOmniTokenPayloadFresh, type OmniTokenPayload } from './omni-token';
import { hasPlatformDashboardAccess } from './mafi-access';

/**
 * Thrown when a DB lookup inside an auth guard exceeds its time budget.
 * A timeout is a TRANSIENT infrastructure problem, NOT an auth failure —
 * the caller must surface it as 503 (retryable), never 401 ("session
 * expired"). Conflating the two is what made a slow database read as a
 * logged-out admin on the dashboard.
 */
class TransientDbError extends Error {}

/** 503 — the request was well-formed and may be authorized; the database
 *  just didn't answer in time. Clients should retry, not re-login. */
function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: 'Service temporarily unavailable — database slow, retry shortly', transient: true },
    { status: 503 },
  );
}

function tokenString(payload: OmniTokenPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function tokenEmail(payload: OmniTokenPayload): string | null {
  return tokenString(payload, 'email') ?? null;
}

function tokenIdentity(payload: OmniTokenPayload) {
  return {
    id: tokenString(payload, 'sub'),
    email: tokenString(payload, 'email'),
    username: tokenString(payload, 'username'),
    role: tokenString(payload, 'role'),
    is_admin: payload.is_admin === true,
  };
}

/** Race a Supabase query against a timer. On timeout, reject with a
 *  TransientDbError so the guard can return 503 instead of hanging the
 *  whole request (which is what pinned the dashboard on its spinner). */
function withDbTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TransientDbError(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Admin Auth Guard — verifies the request comes from an authenticated admin user.
 * Supports two auth schemes:
 *   1. Supabase cookie session (server actions / SSR flows)
 *   2. Bearer token in the Authorization header — the custom base64(JSON) `omni_token`
 *      minted by the `auth-login` edge function (localStorage-based client auth).
 *
 * Status contract (read this before changing return codes):
 *   200  → { user, profile }      caller is an authenticated admin
 *   401  → token/session missing, malformed, or expired (genuine re-login)
 *   403  → valid identity, but not an admin
 *   503  → the DB lookup timed out or errored (TRANSIENT — retry, do NOT
 *          tell the user their session expired)
 */
export async function requireAdmin(): Promise<
  | { user: any; profile: any; error?: never }
  | { error: NextResponse; user?: never; profile?: never }
> {
  try {
    // ── 1. Try Bearer token (omni_token) first ──────────────────────────
    const hdrs = await headers();
    const authz = hdrs.get('authorization') || '';
    const bearer = authz.replace(/^Bearer\s+/i, '').trim();

    if (bearer) {
      // Decode the token structurally. A malformed token is NOT a valid
      // session → fall through to the cookie path. A well-formed,
      // unexpired token IS a genuine session → from here on, DB failures
      // are transient (503), never auth failures (401).
      const payload = decodeOmniToken(bearer);
      const tokenValid = isOmniTokenPayloadFresh(payload);

      if (tokenValid && payload) {
        if (hasPlatformDashboardAccess(tokenIdentity(payload))) {
          return {
            user: { id: payload.sub, email: tokenEmail(payload) },
            profile: {
              id: payload.sub,
              email: tokenEmail(payload),
              role: 'admin',
              is_admin: true,
              tier_label: 'admin',
            },
          };
        }

        try {
          const sb = createAdminClient();
          const { data: profile, error } = await withDbTimeout(
            sb
              .from('profiles')
              .select('id, role, is_admin, tier_label, email')
              .eq('id', payload.sub)
              .single(),
            6000,
            'admin profile lookup (bearer)',
          );

          if (error) {
            // PGRST116 = no row found → the token's subject genuinely has
            // no profile (real auth problem). Any other PostgREST error
            // is a database fault → transient.
            if ((error as { code?: string }).code === 'PGRST116') {
              return {
                error: NextResponse.json(
                  { error: 'Unauthorized — profile not found' },
                  { status: 401 },
                ),
              };
            }
            return { error: serviceUnavailable() };
          }

          if (
            profile &&
            (profile.is_admin === true ||
              profile.role === 'admin' ||
              profile.tier_label === 'admin')
          ) {
            return { user: { id: profile.id, email: profile.email }, profile };
          }

          // Valid token, profile resolved, but not an admin.
          return {
            error: NextResponse.json(
              { error: 'Forbidden — admin access required' },
              { status: 403 },
            ),
          };
        } catch (e) {
          // Timeout or thrown DB error on a VALID token → transient.
          // Never downgrade a valid session to 401 because the DB stalled.
          if (e instanceof TransientDbError) return { error: serviceUnavailable() };
          return { error: serviceUnavailable() };
        }
      }
      // Token present but malformed/expired → fall through to cookie path.
    }

    // ── 2. Fallback: Supabase cookie session ────────────────────────────
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
            // Read-only in route handlers
          },
        },
      }
    );

    let user: { id: string; email?: string | null } | null = null;
    try {
      const { data, error: authError } = await withDbTimeout(
        supabase.auth.getUser(),
        6000,
        'cookie session getUser',
      );
      if (authError || !data?.user) {
        return {
          error: NextResponse.json(
            { error: 'Unauthorized — no valid session' },
            { status: 401 }
          ),
        };
      }
      user = data.user;
    } catch (e) {
      // getUser timed out → transient, not a missing session.
      if (e instanceof TransientDbError) return { error: serviceUnavailable() };
      return { error: serviceUnavailable() };
    }

    try {
      const { data: profile, error: profileError } = await withDbTimeout(
        supabase
          .from('profiles')
          .select('id, role, is_admin')
          .eq('id', user.id)
          .single(),
        6000,
        'admin profile lookup (cookie)',
      );

      if (profileError) {
        if ((profileError as { code?: string }).code === 'PGRST116') {
          return {
            error: NextResponse.json(
              { error: 'Unauthorized — profile not found' },
              { status: 401 }
            ),
          };
        }
        return { error: serviceUnavailable() };
      }

      if (!profile) {
        return {
          error: NextResponse.json(
            { error: 'Unauthorized — profile not found' },
            { status: 401 }
          ),
        };
      }

      const isAdmin = profile.is_admin === true || profile.role === 'admin';
      if (!isAdmin) {
        return {
          error: NextResponse.json(
            { error: 'Forbidden — admin access required' },
            { status: 403 }
          ),
        };
      }

      return { user, profile };
    } catch (e) {
      if (e instanceof TransientDbError) return { error: serviceUnavailable() };
      return { error: serviceUnavailable() };
    }
  } catch (err) {
    // Anything that reaches here is an unexpected fault in the guard
    // itself, not a deliberate auth decision (those all return above).
    // Treat as transient so a hiccup never reads as "session expired".
    return { error: serviceUnavailable() };
  }
}

/**
 * Resolve the caller's profile row from either a Bearer omni_token OR a
 * Supabase cookie session. Returns null when no valid auth is present.
 * Factored out of requireAdmin() so both auth flows (admin-only and
 * admin-or-brand-member) share one implementation.
 */
async function resolveCallerProfile(): Promise<
  | {
      id: string;
      email: string | null;
      role: string | null;
      is_admin: boolean | null;
      tier_label: string | null;
    }
  | null
> {
  // ── 1. Bearer token (omni_token) ─────────────────────────────────
  try {
    const hdrs = await headers();
    const authz = hdrs.get('authorization') || '';
    const bearer = authz.replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      const payload = decodeOmniToken(bearer);
      if (isOmniTokenPayloadFresh(payload)) {
        if (hasPlatformDashboardAccess(tokenIdentity(payload))) {
          return {
            id: payload.sub,
            email: tokenEmail(payload),
            role: 'admin',
            is_admin: true,
            tier_label: 'admin',
          };
        }

        const sb = createAdminClient();
        const { data: profile } = await sb
          .from('profiles')
          .select('id, role, is_admin, tier_label, email')
          .eq('id', payload.sub)
          .single();
        if (profile) {
          return profile as ReturnType<typeof resolveCallerProfile> extends Promise<infer T>
            ? Exclude<T, null>
            : never;
        }
      }
    }
  } catch {
    /* fall through to cookie check */
  }

  // ── 2. Supabase cookie session ───────────────────────────────────
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
    if (!user) return null;

    const sb = createAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id, role, is_admin, tier_label, email')
      .eq('id', user.id)
      .single();
    return (
      (profile as ReturnType<typeof resolveCallerProfile> extends Promise<infer T>
        ? Exclude<T, null>
        : never) ?? null
    );
  } catch {
    return null;
  }
}

function isPlatformAdminProfile(profile: {
  role: string | null;
  is_admin: boolean | null;
  tier_label: string | null;
}): boolean {
  if (profile.is_admin === true) return true;
  const role = (profile.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'platform') return true;
  if ((profile.tier_label || '').toLowerCase() === 'admin') return true;
  return false;
}

/**
 * Admin-or-brand-member auth guard for analytics endpoints that need to
 * serve both platform admins AND per-tenant client viewers (Sammy@CPS,
 * Adam@LTB, Alira's owner, etc.).
 *
 * Caller is allowed if EITHER:
 *   - platform admin (is_admin OR role ∈ {admin, owner, platform} OR
 *     tier_label = admin), OR
 *   - mapped to the resolved business via omni_business_users (the
 *     same per-brand membership join /api/dashboard/inbound/[slug]
 *     uses).
 *
 * Resolution order:
 *   1. If scope.slug === 'all' → admin-only (federation rollup).
 *   2. If scope.slug is provided → look up omni_businesses by slug.
 *   3. Else if scope.host is provided → look up omni_businesses by
 *      website (host-normalized: lowercased, stripped of leading
 *      "www."). Matches the dashboard's hostFromWebsite() helper.
 *   4. If neither slug nor host given → admin-only.
 *
 * Returns isAdmin so downstream code can branch on "rollup mode" vs
 * "single tenant" without re-querying.
 */
export async function requireAdminOrBrandMember(
  scope: { slug?: string | null; host?: string | null }
): Promise<
  | {
      user: { id: string; email: string | null };
      profile: { id: string; role: string | null; is_admin: boolean | null; tier_label: string | null; email: string | null };
      isAdmin: boolean;
      error?: never;
    }
  | { error: NextResponse; user?: never; profile?: never; isAdmin?: never }
> {
  const profile = await resolveCallerProfile();
  if (!profile) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized — no valid session' },
        { status: 401 },
      ),
    };
  }

  const isAdmin = isPlatformAdminProfile(profile);
  if (isAdmin) {
    return {
      user: { id: profile.id, email: profile.email },
      profile,
      isAdmin: true,
    };
  }

  // Non-admin path: must be mapped to the resolved business via
  // omni_business_users. Federation rollup ('all') stays admin-only.
  const slug = (scope.slug || '').trim().toLowerCase();
  const host = (scope.host || '').trim().toLowerCase().replace(/^www\./, '');

  if (slug === 'all') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — federation rollup is admin-only' },
        { status: 403 },
      ),
    };
  }

  if (!slug && !host) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — admin access required (no scope provided)' },
        { status: 403 },
      ),
    };
  }

  const sb = createAdminClient();

  // Resolve business by slug first, then fall back to host. Use ilike
  // for case-insensitive matching; the hostname normalization above
  // matches what hostFromWebsite() in the dashboard does.
  let businessId: string | null = null;
  if (slug) {
    const { data: biz } = await sb
      .from('omni_businesses')
      .select('id')
      .ilike('slug', slug)
      .maybeSingle();
    businessId = (biz as { id?: string } | null)?.id ?? null;
  }
  if (!businessId && host) {
    const { data: biz } = await sb
      .from('omni_businesses')
      .select('id')
      .or(`website.ilike.${host},website.ilike.www.${host},website.ilike.https://${host}%,website.ilike.http://${host}%`)
      .maybeSingle();
    businessId = (biz as { id?: string } | null)?.id ?? null;
  }

  if (!businessId) {
    return {
      error: NextResponse.json(
        {
          error: 'Forbidden — no business mapping for this scope',
          slug: slug || null,
          host: host || null,
        },
        { status: 403 },
      ),
    };
  }

  const { data: membership } = await sb
    .from('omni_business_users')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!membership) {
    return {
      error: NextResponse.json(
        {
          error: 'Forbidden — not a member of this brand',
          slug: slug || null,
          host: host || null,
        },
        { status: 403 },
      ),
    };
  }

  return {
    user: { id: profile.id, email: profile.email },
    profile,
    isAdmin: false,
  };
}
