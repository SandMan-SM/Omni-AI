import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { generateDraftFor } from '@/lib/federation-newsletter-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Daily federation-newsletter draft generator.
 *
 * Each federation site's vercel.json cron entry POSTs to:
 *   https://omnileadsagi.com/api/federation-newsletter/generate-daily
 *     ?site=<slug>&secret=$OMNI_FEDERATION_CRON_SECRET
 *
 * The endpoint:
 *   1. Validates the cron secret (rejects unauth).
 *   2. Calls Claude with the site's brief to draft today's dispatch.
 *   3. Inserts the row in federation_newsletter_posts as status='draft'.
 *   4. Emails the operator a preview with HMAC-signed Approve / Reject links.
 *
 * Idempotent: if a row already exists for this site today, returns it
 * without regenerating (so a Vercel cron retry doesn't double-send drafts).
 */

const CRON_SECRET = process.env.OMNI_FEDERATION_CRON_SECRET || '';

function unauthorized(reason: string) {
  return NextResponse.json(
    { ok: false, error: `unauthorized: ${reason}` },
    { status: 401 },
  );
}

async function handle(req: Request) {
  noStore();
  const url = new URL(req.url);
  const site = (url.searchParams.get('site') || '').trim();
  const providedSecret =
    url.searchParams.get('secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!site) {
    return NextResponse.json(
      { ok: false, error: 'site query param required' },
      { status: 400 },
    );
  }

  // Allow Vercel's internal cron header as an alternative auth path.
  // Vercel sets `x-vercel-cron: 1` on cron-triggered invocations and the
  // Authorization header carries the project's CRON_SECRET when configured.
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const secretOk = CRON_SECRET
    ? providedSecret === CRON_SECRET
    : isVercelCron;

  if (!secretOk) return unauthorized('bad cron secret');

  const result = await generateDraftFor(site);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
