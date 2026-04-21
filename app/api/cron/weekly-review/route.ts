import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gatherClientReview, buildClientReviewHtml } from '@/lib/client-review';
import { logShip } from '@/lib/ship-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Sunday 14:00 UTC — generate & email an investor review for every active client. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from('client_portfolio')
    .select('slug, name')
    .eq('status', 'active');

  const results: Array<{ slug: string; emailed: boolean; error?: string }> = [];

  for (const c of clients || []) {
    try {
      const data = await gatherClientReview(c.slug);
      if (!data) {
        results.push({ slug: c.slug, emailed: false, error: 'no data' });
        continue;
      }
      const html = buildClientReviewHtml(data);
      let emailed = false;
      if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Omni AI <bookings@omnileadsagi.com>',
            to: 'sitanim8@gmail.com',
            subject: `Weekly Review · ${c.name} · ${new Date().toISOString().slice(0, 10)}`,
            html,
          }),
        });
        emailed = res.ok;
      }
      results.push({ slug: c.slug, emailed });
    } catch (e: any) {
      results.push({ slug: c.slug, emailed: false, error: e.message });
    }
  }

  await logShip({
    client: 'omni-ai',
    kind: 'infra',
    title: 'Weekly investor reviews sent',
    detail: `${results.filter((r) => r.emailed).length}/${results.length} clients`,
    unlocks: 'Owner-level portfolio clarity',
  });

  return NextResponse.json({ ok: true, results });
}
