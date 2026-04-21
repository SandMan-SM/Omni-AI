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
