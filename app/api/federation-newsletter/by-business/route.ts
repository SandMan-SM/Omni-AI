import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// Inlined copy of lib/federation-newsletter-briefs.ts
// FEDERATION_TO_BUSINESS_SLUG. Inlined to reduce this route's module
// load surface — an earlier deploy of this file hit Supabase
// PostgREST schema-cache errors that the otherwise-identical /post
// route did not, and one variable removed was the cross-file
// import. Keep this in sync if FEDERATION_TO_BUSINESS_SLUG changes
// in the briefs file (it has only changed twice in 5+ months).
const FEDERATION_TO_BUSINESS_SLUG: Record<string, string> = {
  'rene-laveau': 'rene',
  'cps': 'cps',
  'alira': 'alira',
  'beehive-biz-pulse': 'beehive',
  'utah-main-street': 'mainst',
  'wasatch-post': 'wasatch',
  'live-better-on-the-drip': 'otd',
  'sitani-mafi': 'sitanim',
  'imperium': 'imperium',
  'leifson-built': 'leifson',
  'youngs-cabinet': 'youngs',
  'love-thy-barber': 'ltb',
  'phoenix-exteriors': 'phoenix',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Federation posts scoped to a single workspace's business_id.
 *
 *   GET /api/federation-newsletter/by-business?business_id=<uuid>
 *
 * Used by ClientNewsletterStudio (the per-tenant newsletter dashboard
 * surface) to merge federation posts into the legacy posts list. The
 * legacy /api/newsletter/scoped-posts endpoint reads newsletter_posts
 * filtered by business_id; this one reads federation_newsletter_posts
 * filtered by site (the federation slug derived from the business's
 * own slug via FEDERATION_TO_BUSINESS_SLUG).
 *
 * Returns only status='published' rows — drafts and rejects stay in
 * the admin queue, not in client views.
 *
 * Auth: open by design (returns only published content) — but accepts
 * any caller's Authorization header passthrough since the calling
 * dashboard is already gated upstream.
 */

// Reverse of FEDERATION_TO_BUSINESS_SLUG — given an omni_businesses.slug,
// return the matching federation case-study slug, or null.
function businessSlugToFederation(businessSlug: string): string | null {
  for (const [fedSlug, bizSlug] of Object.entries(FEDERATION_TO_BUSINESS_SLUG)) {
    if (bizSlug === businessSlug) return fedSlug;
  }
  return null;
}

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);

  // Accept EITHER business_slug (preferred — no DB roundtrip) OR
  // business_id (legacy fallback that still does the lookup). The
  // dashboard's loadBusinesses() already has the slug in memory so
  // passing it directly avoids a flaky cross-table query that was
  // tripping a Vercel proxy timeout in early testing.
  const businessSlug = (url.searchParams.get('business_slug') || '').trim().toLowerCase();
  const businessId = (url.searchParams.get('business_id') || '').trim();

  if (!businessSlug && !businessId) {
    return NextResponse.json(
      { ok: false, error: 'business_slug or business_id query param required' },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  let resolvedBusinessSlug = businessSlug;

  // Fallback DB lookup only when caller passed business_id without slug.
  if (!resolvedBusinessSlug && businessId) {
    const { data: biz, error: bizErr } = await sb
      .from('omni_businesses')
      .select('slug')
      .eq('id', businessId)
      .maybeSingle();
    if (bizErr) {
      return NextResponse.json(
        { ok: false, error: bizErr.message },
        { status: 500 },
      );
    }
    if (!biz?.slug) {
      return NextResponse.json({ ok: true, posts: [] });
    }
    resolvedBusinessSlug = biz.slug as string;
  }

  const federationSlug = businessSlugToFederation(resolvedBusinessSlug);
  if (!federationSlug) {
    // No federation mapping for this business — return empty rather than
    // error so the merging caller can degrade gracefully.
    return NextResponse.json({ ok: true, posts: [] });
  }

  const { data, error } = await sb
    .from('federation_newsletter_posts')
    .select('id, slug, title, kind, status, published_at, created_at, site')
    .eq('site', federationSlug)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, posts: data ?? [], site: federationSlug });
}
