import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOutreachEmail } from '@/lib/agi/resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Vercel cron: hits this every hour and fires any scheduled emails whose
// scheduled_at is in the past.
//
// vercel.json:
//   { "crons": [{ "path": "/api/cron/send-scheduled", "schedule": "0 * * * *" }] }
export async function GET(req: NextRequest) {
  // Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>`
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Smart pacing: only send Mon-Fri, 8am-6pm Pacific (lead's business hours
  // are usually US Pacific for a lead-gen agency). Skip weekends and nights.
  const now = new Date();
  const pacificHour = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }));
  const pacificDay = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' });
  const isBizHour = pacificHour >= 8 && pacificHour < 18;
  const isBizDay = !['Sat', 'Sun'].includes(pacificDay);

  if (!isBizHour || !isBizDay) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: true,
      reason: `Outside business hours (${pacificDay} ${pacificHour}:00 PT). Sends only Mon-Fri 8am-6pm PT.`,
    });
  }

  // Rate limit: max 25 emails per cron tick to avoid spam triggers
  const { data: assets, error } = await supabase
    .from('omni_outreach_assets')
    .select('id, lead_id, subject, body, asset_type')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!assets || assets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No scheduled emails ready' });
  }

  let sent = 0;
  let failed = 0;

  for (const asset of assets) {
    if (asset.asset_type !== 'email') continue;
    const { data: lead } = await supabase
      .from('omni_leads_generated')
      .select('email')
      .eq('id', asset.lead_id)
      .single();

    if (!lead?.email) {
      await supabase
        .from('omni_outreach_assets')
        .update({ status: 'bounced' })
        .eq('id', asset.id);
      failed++;
      continue;
    }

    const result = await sendOutreachEmail({
      asset_id: asset.id,
      to: lead.email,
      subject: asset.subject ?? '(no subject)',
      body: asset.body,
    });

    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, sent, failed, total: assets.length });
}
