import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gatherClientReview, buildClientReviewHtml } from '@/lib/client-review';
import { logShip } from '@/lib/ship-log';
import { constantTimeEqual } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Sunday 14:00 UTC — generate & email an investor review for every active client. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
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
            from: 'Omni AI <bookings@omnios.news>',
            to: 'sitanim8@gmail.com',
            subject: `Weekly Review · ${c.name} · ${new Date().toISOString().slice(0, 10)}`,
            html,
          }),
        });
        emailed = res.ok;
        // `emailed` already records success/failure in the response, but
        // without the body slice on failure the operator only sees
        // `emailed: false` with no signal *why* (quota, rotated key,
        // unverified domain, etc.). Log the body so Vercel logs carry
        // the actionable reason alongside the status code.
        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          console.error(
            `[cron/weekly-review] resend ${res.status} slug=${c.slug}: ${bodyText.slice(0, 300)}`
          );
        }
      }
      results.push({ slug: c.slug, emailed });
    } catch (e: unknown) {
      // Full supabase/resend error server-side; scrubbed tag in the
      // response. Previously `e.message` leaked raw postgres /
      // fetch-layer text to whoever calls the cron endpoint.
      console.error('[cron/weekly-review]', c.slug, e);
      results.push({ slug: c.slug, emailed: false, error: 'review failed' });
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
