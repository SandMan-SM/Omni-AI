import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Admin-only federation newsletter list endpoint.
 *
 *   GET /api/federation-newsletter/list?status=draft|published|rejected|all
 *
 * Returns rows from federation_newsletter_posts filtered by status,
 * with all fields including body_md so the in-dashboard approval UI
 * (components/newsletter-studio/FederationNewsletterPanel) can render
 * the full draft inline without a second round-trip.
 *
 * Auth: requireAdmin() — same gate the regular admin analytics endpoint
 * uses. Per-tenant viewers don't see other tenants' drafts; if a client
 * viewer needs published posts for their own site, they hit the
 * existing public read endpoint /api/federation-newsletter/post?site=…
 * which is already site-scoped and CORS-open.
 *
 * Default status is "draft" since the dashboard panel's primary use is
 * the operator's approval queue. Use status=all to surface published
 * + rejected + draft together for archive views.
 */

export async function GET(req: Request) {
  noStore();
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const statusParam = (url.searchParams.get('status') || 'draft').trim().toLowerCase();
  const allowed = new Set(['draft', 'approved', 'published', 'rejected', 'all']);
  if (!allowed.has(statusParam)) {
    return NextResponse.json(
      { ok: false, error: `invalid status: ${statusParam}` },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  let q = sb
    .from('federation_newsletter_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (statusParam !== 'all') {
    q = q.eq('status', statusParam);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, posts: data ?? [] });
}
