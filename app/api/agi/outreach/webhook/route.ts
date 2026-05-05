import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { handleResendWebhook } from '@/lib/agi/resend';

// Resend posts events here for opens, clicks, replies, bounces.
// Configure in Resend dashboard: https://resend.com/webhooks
//   URL: https://omnileadsagi.com/api/agi/outreach/webhook
//
// Verifies Svix-style signatures (Resend uses Svix under the hood).
// Without this gate, anyone could POST forged 'opened'/'replied'/'bounced'
// events that mutate omni_outreach_assets — inflating open rates,
// downgrading 'replied' to 'sent' (we already harden 'opened' against
// that in lib/agi/resend.ts but every other event was unauth), or
// flagging messages as bounced to choke the warmup curve.
//
// Set RESEND_WEBHOOK_SECRET to the `whsec_…` value Resend generates
// per endpoint. If not set, we fail closed on any incoming POST so
// fake events can't slip through.
function verifySvixSignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sig = headers.get('svix-signature');
  if (!id || !ts || !sig) return false;

  // Replay protection: reject timestamps older than 5 minutes
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageMs = Math.abs(Date.now() - tsNum * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  // Strip the whsec_ prefix and base64-decode the secret
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const toSign = `${id}.${ts}.${body}`;
  const expected = createHmac('sha256', secretBytes).update(toSign).digest('base64');

  // sig is space-separated "v1,<base64> v2,<base64>"; accept any v1 match
  for (const part of sig.split(' ')) {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) continue;
    const expBuf = Buffer.from(expected, 'utf8');
    const gotBuf = Buffer.from(value, 'utf8');
    if (expBuf.length === gotBuf.length && timingSafeEqual(expBuf, gotBuf)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!verifySvixSignature(body, req.headers)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const event = JSON.parse(body);
    await handleResendWebhook(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[outreach/webhook]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
