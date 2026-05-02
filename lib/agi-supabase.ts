import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy-init Supabase client.
 *
 * BEFORE: `export const supabase = createClient(url, key)` instantiated
 * the client at module scope. Every Next.js build's "Collect page data"
 * step imports this module for any route that uses it — which crashes
 * with "supabaseUrl is required" if env vars aren't present at build
 * time. That's the bug that broke every Preview deployment whose env
 * scope didn't include NEXT_PUBLIC_SUPABASE_URL (Production-only by
 * default).
 *
 * AFTER: a Proxy forwards every access to a singleton instantiated on
 * first use. The build no longer touches Supabase config — only the
 * runtime does. Env vars can stay missing during page-data collection
 * without crashing the build, and runtime gets a clean error when a
 * route actually tries to talk to Supabase without config.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'In Vercel, set both to scope "All Environments" (Production / Preview / Development).'
    );
  }
  _client = createClient(url, key);
  return _client;
}

// Proxy lets `supabase.from(...)` / `supabase.auth.*` etc. work while
// keeping client construction lazy. Every property access goes through
// getClient(), which is cheap after the first call (cached singleton).
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop);
  },
});

export type Business = {
  id: string;
  name: string;
  slug?: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  plan: 'starter' | 'pro' | 'enterprise';
  contact_email: string | null;
  partnership_blurb?: string | null;
  brand_logo_url?: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  business_id: string;
  name: string;
  icp: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed';
  leads_target: number;
  leads_generated: number;
  created_at: string;
};

export type Lead = {
  id: string;
  business_id: string;
  campaign_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  lead_location: string | null;
  linkedin_url: string | null;
  source: 'apollo' | 'web' | 'linkedin' | 'referral' | 'manual';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  score: number;
  notes: string | null;
  tags: string[] | null;
  raw_data?: Record<string, unknown>;
  created_at: string;
  // Pipeline / AI metadata
  deal_value?: number | null;
  deal_stage?: 'lead' | 'contacted' | 'qualified' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | null;
  expected_close_date?: string | null;
  ai_score_reasoning?: string | null;
  ai_recommended_angle?: string | null;
  win_loss_reason?: string | null;
  win_loss_category?: string | null;
  competitor_name?: string | null;
  // Sync provenance
  source_table?: string | null;
  source_record_id?: string | null;
  updated_at?: string | null;
};
