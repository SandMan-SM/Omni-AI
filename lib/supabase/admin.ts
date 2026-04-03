import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * Supabase Admin Client — Service Role (bypasses RLS)
 * Use ONLY in server-side API routes, never in client components.
 */
export function createAdminClient() {
  const env = serverEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
