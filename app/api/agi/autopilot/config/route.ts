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
  // Auth-gate. Without auth + without business_id, GET returns
  // every tenant's autopilot config (which Claude routes are armed,
  // min_score_to_send, max_leads_per_run, followup cadence) — both
  // a privacy leak and a recipe for crafting a follow-up attack.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');

  let query = supabase.from('omni_autopilot_config').select('*');
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data });
}

// Allowlist on PATCH so a caller can't tamper with last_run_at /
// total_runs (telemetry) or write columns we haven't designed for.
const PATCHABLE_AUTOPILOT_FIELDS = new Set([
  'enabled',
  'auto_generate_outreach',
  'auto_schedule_sequences',
  'auto_categorize_replies',
  'auto_draft_responses',
  'auto_score_with_ai',
  'auto_followup_on_open',
  'min_score_to_send',
  'max_leads_per_run',
  'followup_after_days',
]);

export async function PATCH(req: NextRequest) {
  // Auth-gate. Allowlist below blocks mass-assignment but PATCH still
  // needs auth: flipping `enabled=true` arms automated outbound on
  // any tenant, and `min_score_to_send=0` floods their entire lead
  // list with Claude-drafted email through Resend.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { business_id } = body as { business_id?: string };
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'business_id') continue;
    if (PATCHABLE_AUTOPILOT_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('omni_autopilot_config')
    .upsert({ business_id, ...updates }, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
