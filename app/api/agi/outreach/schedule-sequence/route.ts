import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// One-click "Schedule Entire Sequence":
// - Touch 1: schedule for next business hour
// - Touch 2: scheduled_at = +3 days
// - Touch 3: scheduled_at = +7 days
// All touches respect business-hour pacing in the cron.
export async function POST(req: NextRequest) {
  // Auth-gate. POST flips every draft email asset for a lead to
  // status='scheduled' — same risk as outreach/send PATCH but in
  // bulk. Without auth, attackers schedule any tenant's drafts to
  // deploy at an attacker-chosen time.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { lead_id, start_at } = await req.json() as {
      lead_id: string;
      start_at?: string; // ISO; defaults to now
    };

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const start = start_at ? new Date(start_at) : new Date();

    const { data: assets, error: fetchErr } = await supabase
      .from('omni_outreach_assets')
      .select('id, touch_number, send_after_days, asset_type')
      .eq('lead_id', lead_id)
      .eq('asset_type', 'email')
      .eq('status', 'draft')
      .order('touch_number', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!assets || assets.length === 0) {
      return NextResponse.json({
        error: 'No draft email assets found for this lead. Generate outreach first.',
      }, { status: 400 });
    }

    const updates = assets.map(a => {
      const sched = new Date(start);
      sched.setDate(sched.getDate() + (a.send_after_days ?? 0));
      return {
        id: a.id,
        scheduled_at: sched.toISOString(),
      };
    });

    // Update each asset
    for (const u of updates) {
      await supabase
        .from('omni_outreach_assets')
        .update({ status: 'scheduled', scheduled_at: u.scheduled_at })
        .eq('id', u.id);
    }

    return NextResponse.json({
      ok: true,
      scheduled: updates.length,
      schedule: updates.map((u, i) => ({
        touch: assets[i].touch_number,
        send_at: u.scheduled_at,
      })),
    });
  } catch (err) {
    console.error('[outreach/schedule-sequence]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
