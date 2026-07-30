/**
 * Generic inbound lead notification — fan-out to Resend + Telegram for
 * any client slug. Mirrors the CPS-bespoke `lib/cps-notify.ts` shape but
 * accepts a brand label so the subject / heading / dashboard deeplink
 * read correctly per client.
 *
 * Telegram is best-effort. Registry-driven lead intake uses the receipt
 * returned by the Resend helper to fail closed until the required owner
 * notification has been accepted and its state persisted.
 */

import { INBOUND_SLUG_LABELS, type InboundSlug } from '@/lib/inbound-types';
import {
  AGENTIC_DASHBOARD_LABEL,
  AGENTIC_DASHBOARD_URL,
} from '@/lib/agentic-dashboard';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

export type InboundLead = {
  id: string;
  slug: InboundSlug;
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  source: string;
  pageUrl?: string | null;
};

export type InboundEmailReceipt =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyOwnerEmailInboundWithReceipt(
  lead: InboundLead,
): Promise<InboundEmailReceipt> {
  if (!RESEND_API_KEY) return { ok: false, error: 'resend_not_configured' };
  const brand = INBOUND_SLUG_LABELS[lead.slug] ?? lead.slug;
  const name = escape(lead.name);
  const email = lead.email ? escape(lead.email) : '';
  const phone = lead.phone ? escape(lead.phone) : '';
  const message = lead.message ? escape(lead.message) : '';
  const source = escape(lead.source);
  const pageUrl = lead.pageUrl ? escape(lead.pageUrl) : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
      <h2 style="margin:0 0 8px;color:#1f3b8c">New ${escape(brand)} lead</h2>
      <p style="margin:0 0 16px;color:#666">Source: <strong>${source}</strong></p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:100px">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee">${name}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="tel:${phone}" style="color:#1f3b8c">${phone}</a></td></tr>` : ''}
        ${email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${email}" style="color:#1f3b8c">${email}</a></td></tr>` : ''}
        ${pageUrl ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Page</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${pageUrl}" style="color:#1f3b8c">${pageUrl}</a></td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px 0;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>` : ''}
      </table>
      <p style="margin-top:24px;color:#888;font-size:13px">View in dashboard: <a href="${AGENTIC_DASHBOARD_URL}" style="color:#1f3b8c">${AGENTIC_DASHBOARD_LABEL}</a></p>
    </div>
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Idempotency-Key': `inbound-owner-${lead.slug}-${lead.id}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `New ${brand} lead — ${lead.name}`,
        html,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => ({})) as { id?: unknown };
    if (!res.ok) {
      console.error(`[inbound-notify email] Resend rejected request (${res.status})`);
      return { ok: false, error: `resend_http_${res.status}` };
    }
    return {
      ok: true,
      providerId: typeof payload.id === 'string' ? payload.id : null,
    };
  } catch (e) {
    console.error('[inbound-notify email]', e);
    return {
      ok: false,
      error: e instanceof Error && e.name === 'AbortError'
        ? 'resend_timeout'
        : 'resend_request_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyOwnerEmailInbound(lead: InboundLead): Promise<boolean> {
  return (await notifyOwnerEmailInboundWithReceipt(lead)).ok;
}

export async function notifyOwnerTelegramInbound(lead: InboundLead): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  const brand = INBOUND_SLUG_LABELS[lead.slug] ?? lead.slug;
  // Telegram's Markdown parse mode treats *, _, `, [ as control chars —
  // a name like "John_Smith" or a URL with underscores would otherwise
  // make the API return 400 and the notification was silently dropped.
  const md = (s: string | null | undefined) =>
    (s ? String(s) : '').replace(/[*_`\[]/g, c => `\\${c}`);
  const lines = [
    `*New ${md(brand)} lead* — ${md(lead.name)}`,
    lead.phone ? `📞 ${md(lead.phone)}` : null,
    lead.email ? `✉️ ${md(lead.email)}` : null,
    lead.pageUrl ? `🔗 ${md(lead.pageUrl)}` : null,
    lead.message ? `\n${md(lead.message.slice(0, 400))}` : null,
  ].filter(Boolean);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: lines.join('\n'),
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      },
    );
    return res.ok;
  } catch (e) {
    console.error('[inbound-notify telegram]', e);
    return false;
  }
}
