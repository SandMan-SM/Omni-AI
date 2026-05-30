import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
  getPublishedPost,
  getPublishedPostsForSite,
} from '@/lib/federation-newsletter-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Public-read endpoint for federation newsletter posts.
 *
 * Per-site Next.js apps render their /newsletter pages by hitting this
 * endpoint server-side. Each site avoids needing its own Supabase service-
 * role key for the newsletter table — the centralized API route is the
 * single trusted reader.
 *
 * Returns ONLY rows with status='published'. Drafts and rejects are
 * never exposed.
 *
 * Endpoints:
 *   GET ?site=<slug>                → list of published posts (newest first)
 *   GET ?site=<slug>&slug=<post>    → single published post or 404
 *
 * CORS is open since these are public posts intended to be read from any
 * federation site domain. No PII is exposed.
 */

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const site = (url.searchParams.get('site') || '').trim();
  const slug = (url.searchParams.get('slug') || '').trim();

  if (!site) {
    return withCors(
      NextResponse.json(
        { ok: false, error: 'site query param required' },
        { status: 400 },
      ),
    );
  }

  if (slug) {
    const post = await getPublishedPost(site, slug);
    if (!post) {
      return withCors(
        NextResponse.json(
          { ok: false, error: 'not found' },
          { status: 404 },
        ),
      );
    }
    return withCors(NextResponse.json({ ok: true, post }));
  }

  const posts = await getPublishedPostsForSite(site, 30);
  return withCors(NextResponse.json({ ok: true, posts }));
}
