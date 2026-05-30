import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Federation newsletter unsubscribe endpoint.
 *
 *   GET  /api/federation-newsletter/unsubscribe?token=<hmac>
 *   POST /api/federation-newsletter/unsubscribe?token=<hmac>
 *
 * Both verbs supported for RFC 8058 one-click compatibility (Gmail and
 * Apple Mail issue POST when the user hits the inbox-rendered
 * unsubscribe button; we accept GET as well so direct link clicks work
 * too). Token is the same HMAC shape minted by lib/unsubscribe-token.ts
 * and used by the legacy Omni AI newsletter — re-used here to avoid a
 * second secret to rotate.
 *
 * Flips federation_newsletter_subscribers.unsubscribed to true for
 * every row matching the verified email (across all sites the user
 * subscribed to — one token globally unsubscribes; we don't ask the
 * user to do this per-site).
 */

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><style>
      body { font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; color: #222; }
      .ok { color: #10b981; }
      .err { color: #ef4444; }
    </style></head><body>${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

async function handle(req: Request) {
  noStore();
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  const v = verifyUnsubscribeToken(token);
  if (!v.ok) {
    return html(
      `<h1 class="err">❌ Unsubscribe failed</h1><p>Token ${v.reason}.</p>`,
      400,
    );
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from('federation_newsletter_subscribers')
    .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
    .eq('email', v.email);

  if (error) {
    return html(
      `<h1 class="err">❌ Unsubscribe failed</h1><p>${error.message}</p>`,
      500,
    );
  }

  return html(
    `<h1 class="ok">✅ Unsubscribed</h1>
    <p>You're off the list. We've removed <strong>${v.email}</strong> from every federation newsletter — no further emails will arrive.</p>
    <p style="font-size:13px;color:#666;margin-top:24px">If this was a mistake, just re-subscribe on whichever site you'd like to keep receiving from.</p>`,
  );
}

export const GET = handle;
export const POST = handle;
