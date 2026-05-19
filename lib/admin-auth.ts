import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from './supabase/admin';

/**
 * Admin Auth Guard — verifies the request comes from an authenticated admin user.
 * Supports two auth schemes:
 *   1. Supabase cookie session (server actions / SSR flows)
 *   2. Bearer token in the Authorization header — the custom base64(JSON) `omni_token`
 *      minted by the `auth-login` edge function (localStorage-based client auth).
 *
 * Returns { user, profile } on success, or a NextResponse 401/403 on failure.
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
      try {
        const json = Buffer.from(bearer, 'base64').toString('utf8');
        const payload = JSON.parse(json);
        if (payload?.sub && (typeof payload.exp !== 'number' || payload.exp >= Date.now())) {
          const sb = createAdminClient();
          const { data: profile } = await sb
            .from('profiles')
            .select('id, role, is_admin, tier_label, email')
            .eq('id', payload.sub)
            .single();
          if (profile && (profile.is_admin === true || profile.role === 'admin' || profile.tier_label === 'admin')) {
            return { user: { id: profile.id, email: profile.email }, profile };
          }
        }
      } catch {
        // fall through to cookie check
      }
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: NextResponse.json(
          { error: 'Unauthorized — no valid session' },
          { status: 401 }
        ),
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
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
  } catch (err) {
    return {
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    };
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
      const json = Buffer.from(bearer, 'base64').toString('utf8');
      const payload = JSON.parse(json) as { sub?: unknown; exp?: unknown };
      if (
        payload &&
        typeof payload.sub === 'string' &&
        (typeof payload.exp !== 'number' || payload.exp >= Date.now())
      ) {
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
