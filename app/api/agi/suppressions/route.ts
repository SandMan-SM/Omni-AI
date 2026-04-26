import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');

  let query = supabase.from('omni_suppressions').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suppressions: data });
}

export async function POST(req: NextRequest) {
  const { business_id, email, reason, source_asset_id, notes } = await req.json();
  if (!business_id || !email) return NextResponse.json({ error: 'business_id and email required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_suppressions')
    .upsert({ business_id, email, reason: reason ?? 'manual', source_asset_id, notes }, { onConflict: 'business_id,email' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cancel any scheduled outreach for this email
  const { data: leads } = await supabase
    .from('omni_leads_generated')
    .select('id').eq('business_id', business_id).ilike('email', email);
  if (leads?.length) {
    const leadIds = leads.map(l => l.id);
    await supabase
      .from('omni_outreach_assets')
      .update({ status: 'draft' })
      .in('lead_id', leadIds)
      .eq('status', 'scheduled');
    await supabase
      .from('omni_leads_generated')
      .update({ status: 'lost', notes: 'Auto: unsubscribed' })
      .in('id', leadIds);
  }

  return NextResponse.json({ ok: true, suppression: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_suppressions').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
