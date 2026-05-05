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

// Lead activity feed - chronological events for a single lead OR business
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  const business_id = searchParams.get('business_id');
  const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 500);

  let query = supabase
    .from('omni_lead_activity')
    .select('*, lead:omni_leads_generated(first_name, last_name, company)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (lead_id) query = query.eq('lead_id', lead_id);
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}

// Manually log an activity event (useful for notes, calls, custom events)
export async function POST(req: NextRequest) {
  const { lead_id, business_id, event_type, event_subtype, details } = await req.json();
  if (!lead_id || !business_id || !event_type) {
    return NextResponse.json({ error: 'lead_id, business_id, event_type required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('omni_lead_activity')
    .insert({ lead_id, business_id, event_type, event_subtype, details: details ?? {} })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, activity: data });
}
