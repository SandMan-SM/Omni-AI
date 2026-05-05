import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Without auth + without business_id, dumps every
  // tenant's campaigns + ICPs (target market intel).
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');

  let query = supabase.from('omni_lead_campaigns').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

// Insert allowlist — without this, raw spread of req.json() lets a
// caller write arbitrary columns (leads_generated counter, status,
// even foreign key shifts).
const POSTABLE_CAMPAIGN_FIELDS = new Set([
  'business_id', 'name', 'icp', 'leads_target', 'status',
]);

export async function POST(req: NextRequest) {
  // Auth-gate. POST inserted the raw body — combined with anon-role
  // service client, that's both an unauth campaign creator AND a
  // mass-assignment vector for any column on omni_lead_campaigns.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  if (!body?.business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }
  const insert: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (POSTABLE_CAMPAIGN_FIELDS.has(k)) insert[k] = v;
  }
  const { data, error } = await supabase.from('omni_lead_campaigns').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

// Allowlist so callers can't transfer ownership (business_id) or
// rewrite leads_generated counters via PATCH.
const PATCHABLE_CAMPAIGN_FIELDS = new Set([
  'name', 'icp', 'leads_target', 'status',
]);

export async function PATCH(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    if (PATCHABLE_CAMPAIGN_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }
  const { data, error } = await supabase.from('omni_lead_campaigns').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(req: NextRequest) {
  // Auth-gate. DELETE drops a campaign by id — without auth, anyone
  // can wipe a tenant's campaigns (and their cascaded leads).
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('omni_lead_campaigns').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
