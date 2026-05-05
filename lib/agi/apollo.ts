// Apollo enrichment wrapper with credit guard.
// Apollo free plan blocks broad search but allows enrichment (1 credit each).
// We always check credit budget before spending.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type EnrichInput = {
  business_id: string;
  lead_id?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  domain?: string;
  email?: string;
  linkedin_url?: string;
  reveal_personal_emails?: boolean;
};

export type EnrichResult = {
  ok: boolean;
  credit_consumed: boolean;
  credits_remaining_estimate?: number;
  data?: {
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    company?: string | null;
    linkedin_url?: string | null;
    seniority?: string | null;
    department?: string | null;
    location?: string | null;
  };
  error?: string;
};

// Check if business has credit budget before spending.
// Hard stop at limit-5 (5 credits reserved for emergencies).
export async function checkCreditBudget(business_id: string): Promise<{
  ok: boolean;
  used: number;
  limit: number;
  remaining: number;
  reserved: number;
}> {
  const month = new Date().toISOString().slice(0, 7);

  // ensure a row exists for this (business, month) but DO NOT clobber the
  // existing credits_used. Default upsert semantics are ON CONFLICT DO
  // UPDATE — that was zeroing out usage every time the budget check ran,
  // making the gate (`used < limit - reserved`) always pass. ignoreDuplicates
  // makes this an INSERT-or-skip, which is what we actually want here.
  await supabase.from('omni_apollo_credits').upsert({
    business_id,
    month,
    credits_used: 0,
    credits_limit: 95,
  }, { onConflict: 'business_id,month', ignoreDuplicates: true });

  const { data } = await supabase
    .from('omni_apollo_credits')
    .select('credits_used, credits_limit')
    .eq('business_id', business_id)
    .eq('month', month)
    .single();

  const used = data?.credits_used ?? 0;
  const limit = data?.credits_limit ?? 95;
  const reserved = 5;
  const remaining = limit - used;
  const ok = used < limit - reserved;

  return { ok, used, limit, remaining, reserved };
}

// Atomically consume a credit via Postgres function (race-condition safe).
export async function consumeCredit(
  business_id: string,
  lead_id: string | null,
  reveal_type: string,
  cost: number = 1
): Promise<boolean> {
  const { data, error } = await supabase.rpc('omni_consume_credit', {
    p_business_id: business_id,
    p_lead_id: lead_id,
    p_reveal_type: reveal_type,
    p_cost: cost,
  });
  if (error) {
    console.error('[apollo.consumeCredit]', error);
    return false;
  }
  return Boolean(data);
}

// Score a lead BEFORE spending a credit, using free fields only.
// (title, seniority, location, organization size, etc.)
export function scorePreReveal(person: Record<string, unknown>, icp: {
  titles?: string[];
  industries?: string[];
  location?: string;
  seniorities?: string[];
}): number {
  let score = 40; // base

  const title = ((person.title as string) ?? '').toLowerCase();
  const seniority = ((person.seniority as string) ?? '').toLowerCase();
  const personLoc = ((person.city as string) ?? '').toLowerCase();
  const orgIndustry = ((person.organization as { industry?: string })?.industry ?? '').toLowerCase();

  // Title match: +25 (this is the strongest signal)
  if (icp.titles?.some(t => title.includes(t.toLowerCase()))) score += 25;

  // Seniority match: +15
  if (icp.seniorities?.includes(seniority)) score += 15;

  // Location match: +12
  if (icp.location && personLoc.includes(icp.location.toLowerCase().split(',')[0])) score += 12;

  // Industry match: +10
  if (icp.industries?.some(i => orgIndustry.includes(i.toLowerCase()))) score += 10;

  // Has org info: +5 (signals real company)
  if (person.organization) score += 5;

  return Math.min(100, score);
}
