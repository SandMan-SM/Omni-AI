import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { generateDraftFor } from '@/lib/federation-newsletter-pipeline';
import { constantTimeEqual } from '@/lib/api-auth';

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
 * The secret this endpoint accepts is OMNI_FEDERATION_CRON_SECRET, or the
 * project's CRON_SECRET when the former is not set. There is no header-based
 * fallback: see the note at the auth check below.
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

const CRON_SECRET = process.env.OMNI_FEDERATION_CRON_SECRET || process.env.CRON_SECRET || '';

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

  // The shared secret is the ONLY accepted credential.
  //
  // This gate used to fall back to the `x-vercel-cron: 1` request header
  // when OMNI_FEDERATION_CRON_SECRET was not configured, on the theory
  // that only Vercel sends it. It does not — a request header is set by
  // the client — and OMNI_FEDERATION_CRON_SECRET is not set in production,
  // so the fallback was the ONLY path in: verified live, a request with
  // `x-vercel-cron: 1` and no secret got past the gate and ran the
  // pipeline (Claude generation, a row inserted into
  // federation_newsletter_posts, an operator email).
  //
  // The secret now falls back to the project's CRON_SECRET, which IS set
  // in production. With no secret configured at all the gate fails closed
  // with a 503 rather than opening a door.
  if (!CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'federation cron secret not configured' },
      { status: 503 },
    );
  }
  const secretOk = constantTimeEqual(providedSecret, CRON_SECRET);

  if (!secretOk) return unauthorized('bad cron secret');

  const result = await generateDraftFor(site);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
