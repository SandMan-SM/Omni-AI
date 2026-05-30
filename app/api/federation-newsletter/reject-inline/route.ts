import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { rejectPost } from '@/lib/federation-newsletter-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Admin-session-gated reject. Inline cousin of the public token
 * endpoint — same state transition (draft → rejected), no fan-out,
 * but auth comes from the admin's session not an HMAC token.
 *
 *   POST /api/federation-newsletter/reject-inline?id=<uuid>&site=<slug>&reason=<text>
 */

async function handle(req: Request) {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  const site = (url.searchParams.get('site') || '').trim();
  const reason = url.searchParams.get('reason') ?? undefined;
  if (!id || !site) {
    return NextResponse.json(
      { ok: false, error: 'id and site query params required' },
      { status: 400 },
    );
  }

  const result = await rejectPost(id, site, reason);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const POST = handle;
