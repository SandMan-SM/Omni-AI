import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type Business = {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  plan: 'starter' | 'pro' | 'enterprise';
  contact_email: string | null;
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
