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

// Track long-running agent runs with status + progress
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Run rows include input_params and result (often
  // contain lead PII or competitor research) — leak across tenants
  // when business_id is omitted.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const id = searchParams.get('id');

  if (id) {
    const { data, error } = await supabase
      .from('omni_agent_runs').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ run: data });
  }

  let query = supabase.from('omni_agent_runs').select('*').order('created_at', { ascending: false }).limit(50);
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

export async function POST(req: NextRequest) {
  // Auth-gate. Without auth anyone can create fake "agent runs" on
  // any tenant, scrambling the run feed + report-card metrics.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, run_type, input_params } = await req.json();
  if (!business_id || !run_type) {
    return NextResponse.json({ error: 'business_id and run_type required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_agent_runs')
    .insert({ business_id, run_type, input_params: input_params ?? {}, status: 'pending' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, run: data });
}

export async function PATCH(req: NextRequest) {
  // Auth-gate. PATCH writes status/progress/result by id with no
  // business_id filter — without auth, attackers could mark any
  // tenant's runs as 'failed' (denial of service) or inject fake
  // result payloads.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { id, status, progress_pct, progress_message, result, error } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === 'running' && !updates.started_at) updates.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
  }
  if (progress_pct !== undefined) updates.progress_pct = progress_pct;
  if (progress_message !== undefined) updates.progress_message = progress_message;
  if (result !== undefined) updates.result = result;
  if (error !== undefined) updates.error = error;

  const { data, error: dbError } = await supabase
    .from('omni_agent_runs').update(updates).eq('id', id).select().single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true, run: data });
}
