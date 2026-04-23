import { NextResponse } from 'next/server';
import { gatherClientReview, buildClientReviewHtml } from '@/lib/client-review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio/review/[slug]
 *   - Default: returns the rendered HTML (opens in a browser tab)
 *   - ?format=json → returns the raw data
 *   - ?email=1 → also emails the review to sitanim8@gmail.com via Resend
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const doEmail = searchParams.get('email') === '1';

  const data = await gatherClientReview(slug);
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (format === 'json') return NextResponse.json(data);

  const html = buildClientReviewHtml(data);

  if (doEmail && process.env.RESEND_API_KEY) {
    // Previously `await fetch(...)` only caught network/parse errors — a
    // Resend HTTP 4xx/5xx (rotated key, domain unverified, quota) resolved
    // successfully and the caller saw the HTML response as if the email
    // had been sent. Check res.ok and log the body slice so the same
    // silent-failure pattern fixed across 5 other lead-form routes
    // (Cycle 41) also applies here.
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Omni AI <bookings@omnileadsagi.com>',
          to: 'sitanim8@gmail.com',
          subject: `Investor Review · ${data.client.name} · ${new Date().toISOString().slice(0, 10)}`,
          html,
        }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error(
          `[portfolio/review] resend ${res.status} slug=${slug}: ${bodyText.slice(0, 300)}`
        );
      }
    } catch (e) {
      console.error('[portfolio/review] email failed', e);
    }
  }

  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
