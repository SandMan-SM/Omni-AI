import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client — Service Role (bypasses RLS)
 * Use ONLY in server-side API routes, never in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Module-level safe admin client. Defers createAdminClient() until first
 * property access, so importing a module that holds one of these doesn't
 * crash Vercel preview builds (where Supabase env vars aren't set on
 * page-data-collection). Drop-in replacement for `const supabase = createAdminClient()`.
 */
export function createLazyAdminClient(): ReturnType<typeof createAdminClient> {
  let cached: ReturnType<typeof createAdminClient> | null = null;
  return new Proxy({} as ReturnType<typeof createAdminClient>, {
    get(_target, prop, receiver) {
      if (!cached) cached = createAdminClient();
      return Reflect.get(cached, prop, receiver);
    },
  });
}
