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

// 5-step onboarding: 0=business basics, 1=sender identity, 2=ICP/campaign, 3=integrations, 4=first lead
const TOTAL_STEPS = 5;

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Returns sender_email + booking_url + raw onboarding_data
  // for any business_id passed in.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_businesses')
    .select('onboarding_step, onboarding_completed_at, onboarding_data, name, sender_email, booking_url')
    .eq('id', business_id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    step: data.onboarding_step ?? 0,
    total_steps: TOTAL_STEPS,
    completed: Boolean(data.onboarding_completed_at),
    data: data.onboarding_data ?? {},
    progress_pct: Math.round(((data.onboarding_step ?? 0) / TOTAL_STEPS) * 100),
  });
}

export async function PATCH(req: NextRequest) {
  // Auth-gate. PATCH writes onboarding_data + can stamp
  // onboarding_completed_at on any tenant — flips them out of the
  // setup wizard prematurely and clobbers their config blob.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, step, data, complete } = await req.json();
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (step !== undefined) updates.onboarding_step = step;
  if (data !== undefined) updates.onboarding_data = data;
  if (complete) updates.onboarding_completed_at = new Date().toISOString();

  const { data: result, error } = await supabase
    .from('omni_businesses').update(updates).eq('id', business_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, business: result });
}
