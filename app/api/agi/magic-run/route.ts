import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateOutreachAssets } from '@/lib/agi/outreach';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// One-click demo / instant value: takes a single prospect's name + company,
// runs the full pipeline and returns everything in one shot:
//   1. Insert as a lead
//   2. Generate Claude outreach (3 emails + LinkedIn + voicemail)
//   3. Schedule sequence (Day 0 / +3 / +7)
//   4. Return all assets for inline preview
//
// Useful as the homepage "try it" button or sales demo.
export async function POST(req: NextRequest) {
  try {
    const { business_id, first_name, last_name, email, company, title, location, schedule } = await req.json();

    if (!business_id || (!first_name && !email && !company)) {
      return NextResponse.json({
        error: 'business_id and at least one of (first_name, email, company) required',
      }, { status: 400 });
    }

    // 1. Create the lead
    const { data: lead, error: leadErr } = await supabase
      .from('omni_leads_generated')
      .insert({
        business_id,
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        email: email ?? null,
        company: company ?? null,
        title: title ?? null,
        lead_location: location ?? null,
        source: 'manual',
        status: 'new',
        score: 75, // optimistic default for magic-run
      })
      .select()
      .single();

    if (leadErr) throw leadErr;

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', business_id).single();
    if (!business) throw new Error('Business not found');

    // 2. Generate
    const { assets, personalization_notes } = await generateOutreachAssets(lead, business);

    const rows = assets.map(a => ({
      lead_id: lead.id,
      business_id,
      asset_type: a.asset_type,
      touch_number: a.touch_number,
      send_after_days: a.send_after_days,
      subject: a.subject ?? null,
      subject_variants: a.subject_variants ?? null,
      body: a.body,
      ai_personalization_notes: personalization_notes,
      status: schedule && a.asset_type === 'email' ? 'scheduled' as const : 'draft' as const,
      scheduled_at: schedule && a.asset_type === 'email'
        ? new Date(Date.now() + (a.send_after_days ?? 0) * 86400000).toISOString()
        : null,
    }));

    const { data: storedAssets } = await supabase
      .from('omni_outreach_assets')
      .insert(rows)
      .select();

    return NextResponse.json({
      ok: true,
      lead,
      assets: storedAssets,
      personalization_notes,
      scheduled: Boolean(schedule),
    });
  } catch (err) {
    console.error('[magic-run]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
