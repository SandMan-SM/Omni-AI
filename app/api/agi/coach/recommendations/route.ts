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

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Recommendations join lead PII (names + company +
  // title + score) — leak across tenants if business_id is iterated.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_coach_recommendations')
    .select('*, lead:omni_leads_generated(first_name, last_name, company, title, score)')
    .eq('business_id', business_id)
    .eq('acted_on', false)
    .is('dismissed_at', null)
    .order('priority', { ascending: true }) // high first (alphabetical)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recommendations: data });
}

export async function PATCH(req: NextRequest) {
  // Auth-gate. PATCH flips acted_on / dismissed_at by id with no
  // tenant filter — without auth, attackers could mass-dismiss any
  // tenant's recommendations and mute the coach.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { id, acted_on, dismissed } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (acted_on !== undefined) updates.acted_on = acted_on;
  if (dismissed) updates.dismissed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('omni_coach_recommendations')
    .update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recommendation: data });
}
