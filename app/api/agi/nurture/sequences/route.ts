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
  // Auth-gate. Without auth + without business_id this returns
  // every tenant's nurture playbook (steps include subject + body
  // templates) — outreach-strategy intel.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  let query = supabase.from('omni_nurture_sequences').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sequences: data });
}

export async function POST(req: NextRequest) {
  // Auth-gate. POST inserts an arbitrary nurture sequence on any
  // tenant. The steps[] body becomes the source of truth for that
  // tenant's nurture flow once enrolled — attacker-controlled steps
  // could ship attacker copy or attacker links to real prospects.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, name, description, steps } = await req.json();
  if (!business_id || !name || !Array.isArray(steps)) {
    return NextResponse.json({ error: 'business_id, name, steps[] required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_nurture_sequences').insert({ business_id, name, description, steps }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sequence: data });
}
