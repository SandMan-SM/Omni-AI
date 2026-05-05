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

// Vercel cron at 6pm Pacific (1am UTC) — runs digest for every business with a sender_email.
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: businesses } = await supabase
    .from('omni_businesses')
    .select('id, sender_email');

  // Route + target both live under /api/agi/*. Old paths 404'd silently —
  // every business looked "ok" with emailed:undefined, sent_to: 0. Now we
  // strip the right prefix and check r.ok before parsing the response.
  const baseUrl = req.url.replace(/\/api\/agi\/cron\/daily-digest.*/, '');
  const results: Array<{ business_id: string; ok: boolean; emailed?: boolean }> = [];

  for (const b of businesses ?? []) {
    if (!(b as { sender_email?: string }).sender_email) continue;
    const r = await fetch(`${baseUrl}/api/agi/digest/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: b.id, send_email: true }),
    });
    if (!r.ok) {
      results.push({ business_id: b.id, ok: false });
      continue;
    }
    const j = await r.json();
    results.push({ business_id: b.id, ok: j.ok ?? false, emailed: j.emailed });
  }

  return NextResponse.json({ ok: true, sent_to: results.filter(r => r.emailed).length, results });
}
