import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client — Service Role (bypasses RLS)
 * Use ONLY in server-side API routes, never in client components.
 *
 * Returns a Proxy that defers the actual createClient() call until the
 * first property access on the returned object. This is critical for
 * Vercel preview builds: Next.js page-data-collection imports every
 * route module at build time, and many routes do `const supabase =
 * createAdminClient()` at the top level. If the call were eager, the
 * build would crash on any environment where NEXT_PUBLIC_SUPABASE_URL
 * isn't present (e.g. preview deployments, where env vars are scoped
 * to production only).
 *
 * The lazy form still throws at request time if env is missing — same
 * behavior at the actual point of use — but lets the build proceed.
 */
export function createAdminClient(): SupabaseClient {
  let cached: SupabaseClient | null = null;
  return new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
      if (!cached) cached = createUnderlyingClient();
      return Reflect.get(cached, prop, receiver);
    },
  });
}

function createUnderlyingClient(): SupabaseClient {
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
 * Alias kept for callers explicitly using the lazy variant.
 * Identical behavior to createAdminClient — both are lazy now.
 */
export const createLazyAdminClient = createAdminClient;
