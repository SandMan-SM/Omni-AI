import { NextRequest, NextResponse } from 'next/server';
import { handleResendWebhook } from '@/lib/agi/resend';

// Resend posts events here for opens, clicks, replies, bounces.
// Configure in Resend dashboard: https://resend.com/webhooks
//   URL: https://omnileadsagi.com/api/outreach/webhook
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    await handleResendWebhook(event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[outreach/webhook]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
