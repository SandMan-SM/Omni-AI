import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
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
  const { id, acted_on, dismissed } = await req.json();
  const updates: Record<string, unknown> = {};
  if (acted_on !== undefined) updates.acted_on = acted_on;
  if (dismissed) updates.dismissed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('omni_coach_recommendations')
    .update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recommendation: data });
}
