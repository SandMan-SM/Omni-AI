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

// Cron: Monday 9am Pacific (5pm UTC Mon)
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: businesses } = await supabase
    .from('omni_businesses').select('id');

  const baseUrl = req.url.replace(/\/api\/cron\/weekly-retro.*/, '');
  let sent = 0;
  for (const b of businesses ?? []) {
    const r = await fetch(`${baseUrl}/api/retro/weekly`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: b.id, send_email: true }),
    });
    const j = await r.json();
    if (j.emailed) sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
