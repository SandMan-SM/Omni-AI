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

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const status = searchParams.get('status');
  const source = searchParams.get('source');

  let query = supabase.from('omni_leads_generated').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  if (status && status !== 'all') query = query.eq('status', status);
  if (source && source !== 'all') query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

// Columns the dashboard / API clients are allowed to mutate. Anything
// else (id, business_id, source, source_table, source_record_id,
// created_at, …) is intentionally dropped to prevent mass-assignment
// — a caller used to be able to PATCH `{ id, business_id: '<other-tenant>' }`
// and silently transfer ownership of a lead, or PATCH `{ id, score: 100,
// created_at: '2030-01-01' }` to fake metrics.
const PATCHABLE_LEAD_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'title', 'company',
  'lead_location', 'linkedin_url',
  'status', 'score', 'notes', 'tags',
  'deal_value', 'deal_stage', 'expected_close_date',
  'win_loss_reason', 'win_loss_category', 'competitor_name',
  'pipeline_type', 'reply_handled',
  'ai_recommended_angle', 'ai_score_reasoning',
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    if (PATCHABLE_LEAD_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('omni_leads_generated')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
