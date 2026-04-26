import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateOutreachAssets } from '@/lib/agi/outreach';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate outreach for many leads at once. Useful after a CSV import
// or after a campaign agent run. Returns per-lead results.
export async function POST(req: NextRequest) {
  try {
    const { lead_ids, also_schedule } = await req.json() as {
      lead_ids: string[];
      also_schedule?: boolean;
    };

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: 'lead_ids[] required' }, { status: 400 });
    }

    if (lead_ids.length > 50) {
      return NextResponse.json({
        error: 'Max 50 leads per bulk operation. Split into smaller batches.',
      }, { status: 400 });
    }

    const results: Array<{ lead_id: string; ok: boolean; assets?: number; error?: string }> = [];

    // Sequential to avoid rate-limiting Claude API
    for (const lead_id of lead_ids) {
      try {
        const { data: lead } = await supabase
          .from('omni_leads_generated').select('*').eq('id', lead_id).single();
        if (!lead) {
          results.push({ lead_id, ok: false, error: 'Not found' });
          continue;
        }

        const { data: business } = await supabase
          .from('omni_businesses').select('*').eq('id', lead.business_id).single();
        if (!business) {
          results.push({ lead_id, ok: false, error: 'Business not found' });
          continue;
        }

        // Wipe existing drafts
        await supabase
          .from('omni_outreach_assets')
          .delete()
          .eq('lead_id', lead_id)
          .eq('status', 'draft');

        const { assets, personalization_notes } = await generateOutreachAssets(lead, business);

        const rows = assets.map(a => ({
          lead_id, business_id: lead.business_id,
          asset_type: a.asset_type,
          touch_number: a.touch_number,
          send_after_days: a.send_after_days,
          subject: a.subject ?? null,
          subject_variants: a.subject_variants ?? null,
          body: a.body,
          ai_personalization_notes: personalization_notes,
          status: also_schedule && a.asset_type === 'email' ? 'scheduled' as const : 'draft' as const,
          scheduled_at: also_schedule && a.asset_type === 'email'
            ? new Date(Date.now() + (a.send_after_days ?? 0) * 86400000).toISOString()
            : null,
        }));

        await supabase.from('omni_outreach_assets').insert(rows);
        results.push({ lead_id, ok: true, assets: rows.length });
      } catch (err) {
        results.push({
          lead_id, ok: false,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    return NextResponse.json({
      ok: true,
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
    });
  } catch (err) {
    console.error('[outreach/bulk-generate]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
