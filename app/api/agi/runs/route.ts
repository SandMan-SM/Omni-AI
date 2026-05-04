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

// Track long-running agent runs with status + progress
export async function GET(req: NextRequest) {
  noStore();
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
  const { id, status, progress_pct, progress_message, result, error } = await req.json();
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
