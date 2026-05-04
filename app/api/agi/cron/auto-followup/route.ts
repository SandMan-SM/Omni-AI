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

// Cron: every 6 hours, find emails that were:
//   - opened > 2 days ago
//   - never replied
//   - have a touch_2 or touch_3 still in 'draft'
// Schedule the next touch immediately (the lead is engaged but hasn't acted).
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Pull all configs that have auto_followup_on_open
  const { data: configs } = await supabase
    .from('omni_autopilot_config')
    .select('business_id, followup_after_days, enabled, auto_followup_on_open')
    .eq('enabled', true)
    .eq('auto_followup_on_open', true);

  let totalScheduled = 0;
  for (const cfg of configs ?? []) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (cfg.followup_after_days ?? 2));

    // Find opened-but-not-replied assets
    const { data: openedAssets } = await supabase
      .from('omni_outreach_assets')
      .select('lead_id, touch_number')
      .eq('business_id', cfg.business_id)
      .eq('status', 'opened')
      .lt('opened_at', cutoff.toISOString());

    for (const a of openedAssets ?? []) {
      // Check that no reply yet on any asset for this lead
      const { count: replyCount } = await supabase
        .from('omni_outreach_assets')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', a.lead_id)
        .eq('status', 'replied');
      if ((replyCount ?? 0) > 0) continue;

      // Find next-touch draft and schedule it now
      const { data: nextDraft } = await supabase
        .from('omni_outreach_assets')
        .select('id')
        .eq('lead_id', a.lead_id)
        .eq('asset_type', 'email')
        .eq('status', 'draft')
        .gt('touch_number', a.touch_number)
        .order('touch_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextDraft) {
        await supabase
          .from('omni_outreach_assets')
          .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
          .eq('id', nextDraft.id);
        totalScheduled++;
      }
    }
  }

  return NextResponse.json({ ok: true, scheduled_followups: totalScheduled });
}
