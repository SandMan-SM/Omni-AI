import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { generateOutreachAssets } from '@/lib/agi/outreach';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = await req.json() as { lead_id: string };
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabase
      .from('omni_leads_generated')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const { data: business } = await supabase
      .from('omni_businesses')
      .select('*')
      .eq('id', lead.business_id)
      .single();

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Generate FIRST, then replace. The previous order deleted the
    // operator's existing drafts before calling Claude — if generation
    // failed (API timeout, parse error), they were left with zero drafts
    // and no replacement.
    const { assets, personalization_notes } = await generateOutreachAssets(lead, business);

    const rows = assets.map(a => ({
      lead_id,
      business_id: lead.business_id,
      asset_type: a.asset_type,
      touch_number: a.touch_number,
      send_after_days: a.send_after_days,
      subject: a.subject ?? null,
      subject_variants: a.subject_variants ?? null,
      body: a.body,
      ai_personalization_notes: personalization_notes,
      status: 'draft' as const,
    }));

    // Now safe to delete — generation succeeded, we have replacements.
    await supabase
      .from('omni_outreach_assets')
      .delete()
      .eq('lead_id', lead_id)
      .eq('status', 'draft');

    const { data, error } = await supabase
      .from('omni_outreach_assets')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      assets: data,
      personalization_notes,
    });
  } catch (err) {
    console.error('[outreach/generate]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  const business_id = searchParams.get('business_id');

  let query = supabase
    .from('omni_outreach_assets')
    .select('*')
    .order('touch_number', { ascending: true });

  if (lead_id) query = query.eq('lead_id', lead_id);
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data });
}
