import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) return supabaseInstance;
  
  if (!initPromise) {
    initPromise = (async () => {
      const response = await fetch('/api/supabase-config');
      if (!response.ok) {
        throw new Error('Failed to fetch Supabase config');
      }
      const config = await response.json();
      
      if (!config.url || !config.anonKey) {
        throw new Error('Supabase credentials not configured');
      }
      
      supabaseInstance = createClient(config.url, config.anonKey);
      return supabaseInstance;
    })();
  }
  
  return initPromise;
}
