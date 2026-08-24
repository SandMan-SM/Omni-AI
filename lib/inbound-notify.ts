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
import {
  REGISTRY_BRAND_LABELS,
  leadCcDecision,
  leadFromAddress,
} from '@/lib/lead-recipients';
import { CC_LEAD_FROM, HOUSE_LEAD_FROM, leadSenderFor } from '@/lib/lead-sender';
import { resolveLeadSender } from '@/lib/server/lead-sender-registry';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
/*
 * Sends from omnios.news — verified and sending-enabled in Resend.
 *
 * Was `bookings@omnileadsagi.com` until 2026-08-06, when that domain was
 * removed from the Resend account. Resend refuses any send from an unverified
 * domain, and the registry branch of /api/inbound/<slug>/leads is fail-closed
 * on the owner receipt — so the removal did not merely stop the alerts, it made
 * every tenant's lead form return 503 and turn real visitors away. Never point
 * this at a domain that is not verified in the account.
 */
/*
 * Fallback only. Every tenant now derives an on-domain sender from its own
 * slug via leadSenderFor(), so this is reached only if that produced nothing.
 * It stays on the lead domain so the fallback cannot silently reintroduce a
 * second sending domain.
 */
const FROM_EMAIL = HOUSE_LEAD_FROM;
/* Kept separate from the owner's sender so a CC complaint can't taint it. */
const CC_FROM_EMAIL = CC_LEAD_FROM;
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
  /** Originating site's intake row id. Genuine submissions always carry one. */
  intakeId?: string | null;
};

/*
 * Short non-cryptographic digest (FNV-1a). Used only to make an idempotency key
 * vary with the recipient list, so it must be stable and collision-resistant
 * enough for that — not secure.
 */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export type InboundEmailReceipt =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

/*
 * Registry-driven tenants are outside the legacy InboundSlug union, so they
 * miss INBOUND_SLUG_LABELS and used to fall through to the raw database slug —
 * subject lines read "New leadfranchise lead".
 */
function brandLabel(slug: string): string {
  return (
    INBOUND_SLUG_LABELS[slug as InboundSlug] ??
    REGISTRY_BRAND_LABELS[slug] ??
    slug
  );
}

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
  const brand = brandLabel(lead.slug);
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

  const subject = `New ${brand} lead — ${lead.name}`;

  /*
   * federation.lead_senders is the authority for who this is from. The resolver
   * falls back to the derived address on any database trouble, so a slow
   * registry cannot turn into a rejected visitor on a fail-closed route.
   */
  const fromAddress = leadFromAddress(lead.slug, await resolveLeadSender(lead.slug));

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
        from: fromAddress,
        to: [OWNER_EMAIL],
        subject,
        html,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => ({})) as {
      id?: unknown;
      message?: unknown;
      name?: unknown;
    };
    if (!res.ok) {
      /*
       * Log the provider's OWN reason, not just the status.
       *
       * This previously logged the bare status. A 403 says "refused" but not
       * why, and the four plausible causes (unverified domain, revoked key,
       * domain-scoped key, account restriction) need completely different
       * fixes — so diagnosing an outage meant reading the failure state back
       * out of the database rather than the logs. Resend states the cause
       * plainly ("Domain not verified: Verify x.com or update your from
       * domain"); the From address is included because the whole class of bug
       * here is sending from a domain nobody realised was in play.
       */
      const providerMessage =
        typeof payload.message === 'string' ? payload.message : '(no message)';
      console.error(
        `[inbound-notify email] Resend rejected ${lead.slug} (${res.status}) from="${fromAddress}": ${providerMessage}`,
      );
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

/**
 * Send the tenant's configured CC copy of a genuine lead.
 *
 * Deliberately a SEPARATE message rather than a `cc:` field on the owner's
 * email. Resend validates the entire recipient set in one call, and the inbound
 * route is fail-closed on the owner receipt — so a mistyped, bounced or
 * suppressed CC address attached to that call would return a non-ok receipt and
 * 503 the tenant's lead capture. Splitting it means the worst case is that one
 * person misses one email, never that the business stops taking leads.
 *
 * Uses the tenant's own sender where one is configured (Lead Franchise sends
 * from leadfranchise.org), otherwise the house sender on omnios.news.
 *
 * Never throws. Never affects the returned receipt or the HTTP status.
 */
export async function notifyLeadCc(
  lead: InboundLead,
): Promise<{ sent: string[]; suppressed: string | null }> {
  const decision = leadCcDecision(
    lead.slug,
    {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      intakeId: lead.intakeId,
    },
    OWNER_EMAIL,
  );
  if (decision.recipients.length === 0) {
    return { sent: [], suppressed: decision.suppressed };
  }
  if (!RESEND_API_KEY) return { sent: [], suppressed: 'resend_not_configured' };

  const brand = brandLabel(lead.slug);
  const name = escape(lead.name);
  const email = lead.email ? escape(lead.email) : '';
  const phone = lead.phone ? escape(lead.phone) : '';
  const message = lead.message ? escape(lead.message) : '';
  const source = escape(lead.source);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
      <h2 style="margin:0 0 8px;color:#1f3b8c">New ${escape(brand)} lead</h2>
      <p style="margin:0 0 16px;color:#666">Source: <strong>${source}</strong></p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:100px">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee">${name}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="tel:${phone}" style="color:#1f3b8c">${phone}</a></td></tr>` : ''}
        ${email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${email}" style="color:#1f3b8c">${email}</a></td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px 0;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>` : ''}
      </table>
      <p style="margin-top:24px;color:#888;font-size:12px">You receive these because you are listed on ${escape(brand)} lead alerts. Reply STOP to be removed.</p>
    </div>
  `;

  /*
   * The key hashes the sorted recipient list. Resend replays the stored
   * response for a repeated key WITHOUT re-sending, so a key that encoded only
   * the recipient count would return 200 after a recipient was corrected while
   * the new address silently received nothing.
   */
  const audience = fingerprint([...decision.recipients].sort().join(','));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Idempotency-Key': `inbound-cc-${lead.slug}-${lead.id}-${audience}`,
      },
      body: JSON.stringify({
        from: CC_FROM_EMAIL,
        to: decision.recipients,
        subject: `New ${brand} lead — ${lead.name}`,
        html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `[inbound-notify cc] Resend rejected the ${lead.slug} CC (${res.status}) — owner mail unaffected`,
      );
      return { sent: [], suppressed: `resend_http_${res.status}` };
    }
    return { sent: decision.recipients, suppressed: null };
  } catch (e) {
    console.error('[inbound-notify cc]', e);
    return { sent: [], suppressed: 'resend_request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyOwnerEmailInbound(lead: InboundLead): Promise<boolean> {
  return (await notifyOwnerEmailInboundWithReceipt(lead)).ok;
}

export async function notifyOwnerTelegramInbound(lead: InboundLead): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  const brand = brandLabel(lead.slug);
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
