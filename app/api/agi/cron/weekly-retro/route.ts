import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { constantTimeEqual } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cron: Monday 9am Pacific (5pm UTC Mon)
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get('authorization');
  // Constant-time bearer compare so the secret can't be probed
  // byte-by-byte via response-time timing.
  const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: businesses } = await supabase
    .from('omni_businesses').select('id');

  // Route + target both live under /api/agi/* (the old /api/cron/...
  // and /api/retro/... paths don't exist), so the regex never matched and
  // the fetch hit a 404. Cron looked successful (returned ok:true sent:0)
  // while no retros actually went out.
  const baseUrl = req.url.replace(/\/api\/agi\/cron\/weekly-retro.*/, '');
  // Forward CRON_SECRET as Bearer so retro/weekly can require auth without
  // breaking the cron path.
  const cronAuth: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  };
  let sent = 0;
  for (const b of businesses ?? []) {
    const r = await fetch(`${baseUrl}/api/agi/retro/weekly`, {
      method: 'POST', headers: cronAuth,
      body: JSON.stringify({ business_id: b.id, send_email: true }),
    });
    if (!r.ok) continue;
    const j = await r.json();
    if (j.emailed) sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
