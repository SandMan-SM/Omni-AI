import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Picks the winning subject line variant per business+touch
// based on open rate. Requires at least 5 sends per variant for stat-sig.
// After picking, updates draft assets with the winning subject for that touch.
//
// Run periodically or on-demand from the dashboard.
export async function POST(req: NextRequest) {
  try {
    const { business_id, min_sends } = await req.json() as {
      business_id: string;
      min_sends?: number;
    };

    if (!business_id) {
      return NextResponse.json({ error: 'business_id required' }, { status: 400 });
    }

    const minSends = min_sends ?? 5;

    // Get all sent emails for this business with their subject + status
    const { data: assets, error } = await supabase
      .from('omni_outreach_assets')
      .select('id, touch_number, subject, subject_variants, status, opened_at')
      .eq('business_id', business_id)
      .eq('asset_type', 'email')
      .in('status', ['sent', 'opened', 'replied']);

    if (error) throw error;
    if (!assets || assets.length === 0) {
      return NextResponse.json({ ok: true, winners: [], note: 'No sent emails yet' });
    }

    // Group by touch_number, then by subject
    const stats: Record<number, Record<string, { sent: number; opened: number }>> = {};

    for (const a of assets) {
      const subj = a.subject ?? '(none)';
      const touch = a.touch_number;
      if (!stats[touch]) stats[touch] = {};
      if (!stats[touch][subj]) stats[touch][subj] = { sent: 0, opened: 0 };
      stats[touch][subj].sent++;
      if (a.opened_at) stats[touch][subj].opened++;
    }

    // Pick winner per touch
    const winners: Array<{
      touch: number;
      subject: string;
      sent: number;
      opened: number;
      open_rate: number;
      applied: boolean;
    }> = [];

    for (const [touchStr, subjectStats] of Object.entries(stats)) {
      const touch = parseInt(touchStr);
      let bestSubject: string | null = null;
      let bestRate = -1;
      let bestSent = 0;
      let bestOpened = 0;

      for (const [subj, s] of Object.entries(subjectStats)) {
        if (s.sent < minSends) continue;
        const rate = s.opened / s.sent;
        if (rate > bestRate) {
          bestRate = rate;
          bestSubject = subj;
          bestSent = s.sent;
          bestOpened = s.opened;
        }
      }

      if (bestSubject) {
        // Update all draft assets for this business+touch to use the winner
        const { error: updateErr } = await supabase
          .from('omni_outreach_assets')
          .update({ subject: bestSubject })
          .eq('business_id', business_id)
          .eq('asset_type', 'email')
          .eq('touch_number', touch)
          .eq('status', 'draft');

        winners.push({
          touch, subject: bestSubject, sent: bestSent, opened: bestOpened,
          open_rate: Math.round(bestRate * 100) / 100,
          applied: !updateErr,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      winners,
      total_assets_analyzed: assets.length,
    });
  } catch (err) {
    console.error('[outreach/ab-winner]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
