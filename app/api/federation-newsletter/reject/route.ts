import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
  verifyFederationNewsletterToken,
  FEDERATION_NEWSLETTER_TOKEN_KINDS,
} from '@/lib/federation-newsletter-tokens';
import { rejectPost } from '@/lib/federation-newsletter-pipeline';
import { getFederationBrief } from '@/lib/federation-newsletter-briefs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * One-click reject endpoint. Mirror of /approve. Flips the row to
 * 'rejected' status — no public publish, no owner dispatch.
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
  const reason = url.searchParams.get('reason') ?? undefined;

  const v = verifyFederationNewsletterToken(
    token,
    FEDERATION_NEWSLETTER_TOKEN_KINDS.REJECT,
  );
  if (!v.ok) {
    return html(
      `<h1 class="err">❌ Reject failed</h1><p>Token ${v.reason}.</p>`,
      400,
    );
  }

  const result = await rejectPost(v.postId, v.site, reason);
  if (!result.ok) {
    return html(
      `<h1 class="err">❌ Reject failed</h1><p>${result.error ?? 'unknown error'}</p>`,
      500,
    );
  }

  const brief = getFederationBrief(v.site);
  return html(
    `<h1 class="ok">✅ Rejected</h1>
    <p>Today's draft for ${brief?.brandName ?? v.site} was discarded — no public post, no owner email.</p>
    <p><small>Post ID: ${v.postId}</small></p>`,
  );
}

export const GET = handle;
export const POST = handle;
