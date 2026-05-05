import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Track referrals: when an existing lead introduces a new prospect.
// Auto-credits referrer when referee becomes 'qualified' or 'won'.
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Without auth anyone could iterate business_id values
  // and pull referrer/referee names + payout amounts across tenants.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_referrals')
    .select('*, referee:omni_leads_generated!referee_lead_id(first_name, last_name, company, deal_stage)')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate stats
  const arr = data ?? [];
  const stats = {
    total: arr.length,
    won: arr.filter(r => r.status === 'won').length,
    qualified: arr.filter(r => r.status === 'qualified').length,
    pending_rewards: arr.filter(r => ['qualified', 'won'].includes(r.status) && !r.reward_paid_at)
      .reduce((s, r) => s + (r.reward_amount ?? 0), 0),
    paid_rewards: arr.filter(r => r.reward_paid_at)
      .reduce((s, r) => s + (r.reward_amount ?? 0), 0),
  };

  return NextResponse.json({ referrals: arr, stats });
}

export async function POST(req: NextRequest) {
  // Auth-gate. POST mints reward-payout rows + tags the referee lead's
  // source. Without auth: bogus referral entries inflating payouts, or
  // attacker tagging another tenant's lead's source = 'referral'.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, referrer_lead_id, referrer_name, referrer_email, referee_lead_id, reward_amount, notes } = await req.json();
  if (!business_id || (!referrer_lead_id && !referrer_email) || !referee_lead_id) {
    return NextResponse.json({ error: 'business_id, referrer (lead_id or email), referee_lead_id required' }, { status: 400 });
  }

  // Cross-tenant guard: referee must belong to the same business or
  // the source-tagging update below silently mutates another tenant's lead.
  const { data: refereeLead } = await supabase
    .from('omni_leads_generated')
    .select('business_id')
    .eq('id', referee_lead_id)
    .single();
  if (!refereeLead || refereeLead.business_id !== business_id) {
    return NextResponse.json({ error: 'referee_lead_id does not belong to business_id' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('omni_referrals')
    .insert({
      business_id, referrer_lead_id: referrer_lead_id ?? null,
      referrer_name, referrer_email,
      referee_lead_id,
      reward_amount: reward_amount ?? 0,
      notes,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tag the referee lead as 'referral' source
  await supabase
    .from('omni_leads_generated')
    .update({ source: 'referral' })
    .eq('id', referee_lead_id);

  return NextResponse.json({ ok: true, referral: data });
}

export async function PATCH(req: NextRequest) {
  // Auth-gate. PATCH flips status (qualified/won → triggers payout) and
  // stamps reward_paid_at — both money-adjacent. No business_id filter
  // here, so any id with auth bypassed could be flipped cross-tenant.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { id, status, reward_paid_at } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (reward_paid_at) updates.reward_paid_at = reward_paid_at;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('omni_referrals').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, referral: data });
}
