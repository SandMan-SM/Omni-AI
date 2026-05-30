import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { approvePost } from '@/lib/federation-newsletter-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Admin-session-gated approve. Same end result as the public token
 * endpoint (status → published, owner dispatch fires, subscribers
 * fan out) but the auth path is the admin's logged-in session instead
 * of an HMAC token. Used by the in-dashboard FederationNewsletterPanel
 * so the operator can clear the queue inline without round-tripping
 * through their inbox.
 *
 *   POST /api/federation-newsletter/approve-inline?id=<uuid>&site=<slug>
 */

async function handle(req: Request) {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  const site = (url.searchParams.get('site') || '').trim();
  if (!id || !site) {
    return NextResponse.json(
      { ok: false, error: 'id and site query params required' },
      { status: 400 },
    );
  }

  const result = await approvePost(id, site);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const POST = handle;
