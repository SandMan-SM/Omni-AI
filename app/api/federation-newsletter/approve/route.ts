import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
  verifyFederationNewsletterToken,
  FEDERATION_NEWSLETTER_TOKEN_KINDS,
} from '@/lib/federation-newsletter-tokens';
import { approvePost } from '@/lib/federation-newsletter-pipeline';
import { getFederationBrief } from '@/lib/federation-newsletter-briefs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * One-click approve endpoint for federation newsletter drafts.
 *
 * The operator clicks the green "Approve" button in the draft email and
 * lands here with the HMAC-signed token. We verify the token, ensure it
 * carries the `na` (newsletter-approve) kind, then flip the row from
 * 'draft' to 'published' and dispatch to the business owner.
 *
 * Renders a tiny HTML confirmation page (no React, no client JS) so the
 * operator's browser shows clear success/failure without bouncing back to
 * a SPA.
 */

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Federation Newsletter</title><style>
      body { font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; color: #222; }
      .ok { color: #10b981; }
      .err { color: #ef4444; }
      a { color: #d4af37; }
    </style></head><body>${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

async function handle(req: Request) {
  noStore();
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  const v = verifyFederationNewsletterToken(
    token,
    FEDERATION_NEWSLETTER_TOKEN_KINDS.APPROVE,
  );
  if (!v.ok) {
    return html(
      `<h1 class="err">❌ Approve failed</h1><p>Token ${v.reason}.</p>`,
      400,
    );
  }

  const result = await approvePost(v.postId, v.site);
  if (!result.ok) {
    return html(
      `<h1 class="err">❌ Approve failed</h1><p>${result.error ?? 'unknown error'}</p>`,
      500,
    );
  }

  const brief = getFederationBrief(v.site);
  const publicHref = brief
    ? `https://${brief.domain}/newsletter/`
    : `/newsletter/`;
  return html(
    `<h1 class="ok">✅ Approved + dispatched</h1>
    <p>Published to <a href="${publicHref}">${brief?.brandName ?? v.site}</a> and emailed the business owner.</p>
    <p><small>Post ID: ${v.postId}</small></p>`,
  );
}

export const GET = handle;
export const POST = handle;
