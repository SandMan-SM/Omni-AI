import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
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
  const { business_id, referrer_lead_id, referrer_name, referrer_email, referee_lead_id, reward_amount, notes } = await req.json();
  if (!business_id || (!referrer_lead_id && !referrer_email) || !referee_lead_id) {
    return NextResponse.json({ error: 'business_id, referrer (lead_id or email), referee_lead_id required' }, { status: 400 });
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
  const { id, status, reward_paid_at } = await req.json();
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (reward_paid_at) updates.reward_paid_at = reward_paid_at;

  const { data, error } = await supabase
    .from('omni_referrals').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, referral: data });
}
