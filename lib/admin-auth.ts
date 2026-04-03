import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Admin Auth Guard — verifies the request comes from an authenticated admin user.
 * Use at the top of every /api/admin/* route handler.
 *
 * Returns { user, profile } on success, or a NextResponse 401/403 on failure.
 */
export async function requireAdmin(): Promise<
  | { user: any; profile: any; error?: never }
  | { error: NextResponse; user?: never; profile?: never }
> {
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
            // Read-only in route handlers
          },
        },
      }
    );

    // 1. Verify JWT / session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: NextResponse.json(
          { error: 'Unauthorized — no valid session' },
          { status: 401 }
        ),
      };
    }

    // 2. Check admin role in profiles table
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
