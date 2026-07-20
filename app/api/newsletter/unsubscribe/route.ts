// /api/newsletter/unsubscribe — one-click unsubscribe for newsletter
// emails. Honours both:
//  - GET ?token=...  (link click from the email footer)
//  - POST + List-Unsubscribe-Post: List-Unsubscribe=One-Click  (RFC 8058 — Gmail / Apple Mail
//    auto-fire this in the background when the user clicks the
//    native "Unsubscribe" button next to the From line)
//
// The token is HMAC-signed (lib/unsubscribe-token.ts) so we don't need
// a recipient session — proof of consent IS the email arriving in
// their inbox.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnileadsagi.com';
const RENE_TICKET_SOURCE = 'atx_mansion_party_vip';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function cancelScheduledReneTicketEmails(
  sb: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<number> {
  const { data: rows, error } = await sb
    .from('inbound_rene_leads')
    .select('id,raw_data')
    .eq('email', email.toLowerCase())
    .eq('source', RENE_TICKET_SOURCE);

  if (error) {
    console.error('[unsubscribe] Rene reminder lookup failed', error);
    return 0;
  }

  const apiKey = process.env.RESEND_API_KEY;
  let canceled = 0;

  await Promise.all(
    (rows ?? []).map(async (row) => {
      const rawData = asObject(row.raw_data);
      const messages = Array.isArray(rawData.ticket_followup_messages)
        ? rawData.ticket_followup_messages
        : [];

      const updatedMessages = await Promise.all(
        messages.map(async (message) => {
          const item = asObject(message);
          const id = typeof item.id === 'string' ? item.id : '';
          const scheduledAt =
            typeof item.scheduled_at === 'string'
              ? item.scheduled_at
              : '';

          if (!id || !scheduledAt || !apiKey) return item;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6_000);
          let cancelAccepted = false;
          try {
            const response = await fetch(
              `https://api.resend.com/emails/${encodeURIComponent(id)}/cancel`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: controller.signal,
                cache: 'no-store',
              },
            );
            cancelAccepted = response.ok;
            if (cancelAccepted) canceled += 1;
          } catch (cancelError) {
            console.error(
              '[unsubscribe] Rene reminder cancellation failed',
              cancelError instanceof Error ? cancelError.name : 'unknown',
            );
          } finally {
            clearTimeout(timeout);
          }

          return {
            ...item,
            cancel_requested_at: new Date().toISOString(),
            cancel_accepted: cancelAccepted,
          };
        }),
      );

      const { error: updateError } = await sb
        .from('inbound_rene_leads')
        .update({
          raw_data: {
            ...rawData,
            ticket_followup_status: 'suppressed',
            ticket_followup_unsubscribed_at: new Date().toISOString(),
            ticket_followup_messages: updatedMessages,
          },
        })
        .eq('id', row.id);
      if (updateError) {
        console.error(
          '[unsubscribe] Rene workflow state update failed',
          updateError,
        );
      }
    }),
  );

  return canceled;
}

function htmlPage(headline: string, body: string, accent = '#9C27B0'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${headline}</title><style>
:root{color-scheme:light dark}
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:8vh auto;padding:24px;line-height:1.55;color:#222;background:#fafafa}
@media(prefers-color-scheme:dark){body{color:#eee;background:#0b0b0c}}
h1{font-weight:600;font-size:22px;margin:0 0 12px}
p{margin:0 0 12px;color:#555}
@media(prefers-color-scheme:dark){p{color:#aaa}}
a{color:${accent}}
.box{border:1px solid #e5e5e5;border-radius:12px;padding:24px;background:#fff}
@media(prefers-color-scheme:dark){.box{background:#161617;border-color:#2a2a2a}}
</style></head><body><div class="box"><h1>${headline}</h1>${body}<p style="margin-top:24px;font-size:13px;opacity:.7">Omni AI · <a href="${SITE_URL}">omnileadsagi.com</a></p></div></body></html>`;
}

async function applyUnsubscribe(email: string): Promise<{ ok: boolean; touched: number }> {
  const sb = createAdminClient();
  let touched = 0;

  // 1) profiles.newsletter_subscribed = false (returns affected ids).
  const { data: pRows } = await sb
    .from('profiles')
    .update({ newsletter_subscribed: false })
    .ilike('email', email)
    .select('id');
  touched += (pRows ?? []).length;

  // 2) newsletter_subscriptions.subscribed = false (legacy table — only
  //    update if the row exists; absence shouldn't be a failure).
  //    No `unsubscribed_at` column on this table — `updated_at` is
  //    bumped automatically by the existing touch trigger.
  const { data: nRows } = await sb
    .from('newsletter_subscriptions')
    .update({ subscribed: false })
    .ilike('email', email)
    .select('id');
  touched += (nRows ?? []).length;

  // 3) Federation newsletters — unsubscribe every publication matching
  //    this email so the legacy footer link and native one-click action
  //    also stop sends from federation publications such as Alira.
  const { data: fnRows } = await sb
    .from('federation_newsletter_subscribers')
    .update({
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
    })
    .ilike('email', email)
    .select('id');
  touched += (fnRows ?? []).length;

  // 4) Append to suppression list (global, business_id=null) — covers
  //    all transactional sends too, not just the newsletter cron path.
  //    Unique key is (business_id, email); upsert idempotently on it.
  await sb
    .from('omni_suppressions')
    .upsert(
      {
        business_id: null,
        email: email.toLowerCase(),
        reason: 'unsubscribe',
        notes: 'list-unsubscribe',
      },
      { onConflict: 'business_id,email', ignoreDuplicates: true },
    );

  // 5) Cancel event reminders that Resend already accepted for future
  // delivery. A suppression row alone cannot stop an existing schedule.
  touched += await cancelScheduledReneTicketEmails(sb, email);

  // 6) Federation Marketing System — flip federation_owners row if any,
  //    and mark every still-scheduled marketing_sends row for this
  //    recipient as suppressed so no further sends fire.
  const { data: foRows } = await sb
    .from('federation_owners')
    .update({ unsubscribed_at: new Date().toISOString() })
    .ilike('email', email)
    .is('unsubscribed_at', null)
    .select('id');
  touched += (foRows ?? []).length;

  await sb
    .from('marketing_sends')
    .update({ suppressed_reason: 'unsubscribed' })
    .ilike('recipient_email', email)
    .is('sent_at', null)
    .is('suppressed_reason', null);

  return { ok: true, touched };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const result = token ? verifyUnsubscribeToken(token) : null;

  if (!result || !result.ok) {
    const reason = result?.ok === false ? result.reason : 'missing_token';
    const html = htmlPage(
      'Unsubscribe link could not be verified',
      `<p>Sorry — that link is ${reason === 'expired' ? 'expired' : 'malformed or unrecognised'}. Email <a href="mailto:alfred@omnileadsagi.com">alfred@omnileadsagi.com</a> and we'll remove you manually.</p>`,
      '#cc4444',
    );
    return new NextResponse(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  await applyUnsubscribe(result.email);
  const transactional = result.kind === 'tx';
  const html = transactional
    ? htmlPage(
        'Event reminders stopped',
        `<p><strong>${escapeHtml(result.email)}</strong> won't receive any more reminders for The House Party.</p>
         <p>Your existing VIP access is unchanged.</p>`,
      )
    : htmlPage(
        "You've been unsubscribed",
        `<p><strong>${escapeHtml(result.email)}</strong> won't receive any more newsletters or marketing email from us.</p>
         <p>Critical account / receipt mail still goes through (we have to). Replies to a sales conversation also still go through. If that's not what you want, reply <em>STOP</em> to any thread and we'll suppress everything.</p>
         <p>Want back in? Re-subscribe at <a href="${SITE_URL}/newsletter">${SITE_URL.replace(/^https?:\/\//,'')}/newsletter</a>.</p>`,
      );
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// RFC 8058 one-click. Gmail/Apple Mail POST with body
// `List-Unsubscribe=One-Click` when the user clicks the native unsub
// button. We accept any POST with a valid token — no body parsing
// required (Gmail's body is a fixed string, not actionable data).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const result = token ? verifyUnsubscribeToken(token) : null;
  if (!result || !result.ok) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
  }
  await applyUnsubscribe(result.email);
  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m] as string);
}
