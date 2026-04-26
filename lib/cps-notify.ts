/**
 * CPS lead notification — fan-out to email (Resend) + Telegram.
 *
 * Used by /api/cps/leads to alert the owner the moment a lead arrives
 * from the CPS website (psychandcustodyevaluations.com). Both channels
 * are best-effort: a missing key or upstream failure logs but never
 * throws, so the lead is always saved even if every channel is down.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';

export type CpsLead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  source: string;
  pageUrl?: string | null;
};

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyOwnerEmail(lead: CpsLead): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const name = escape(lead.name);
  const email = lead.email ? escape(lead.email) : '';
  const phone = lead.phone ? escape(lead.phone) : '';
  const message = lead.message ? escape(lead.message) : '';
  const source = escape(lead.source);
  const pageUrl = lead.pageUrl ? escape(lead.pageUrl) : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
      <h2 style="margin:0 0 8px;color:#1f3b8c">New CPS lead</h2>
      <p style="margin:0 0 16px;color:#666">From psychandcustodyevaluations.com — source: <strong>${source}</strong></p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:100px">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee">${name}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="tel:${phone}" style="color:#1f3b8c">${phone}</a></td></tr>` : ''}
        ${email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${email}" style="color:#1f3b8c">${email}</a></td></tr>` : ''}
        ${pageUrl ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Page</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${pageUrl}" style="color:#1f3b8c">${pageUrl}</a></td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px 0;font-weight:600;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>` : ''}
      </table>
      <p style="margin-top:24px;color:#888;font-size:13px">View in dashboard: <a href="https://omnileadsagi.com/dashboard/cps" style="color:#1f3b8c">omnileadsagi.com/dashboard/cps</a></p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `[CPS] New lead — ${lead.name}${lead.phone ? ` (${lead.phone})` : ''}`,
        html,
        reply_to: lead.email || undefined,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no body>');
      console.error(`[cps-notify] resend ${res.status}: ${txt.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[cps-notify] resend fetch failed', e);
    return false;
  }
}

export async function notifyOwnerTelegram(lead: CpsLead): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  // Markdown safe-escape — Telegram MarkdownV1 only treats *_`[ as special.
  // Using plain Markdown (not V2) keeps the escape list small.
  const md = (s: string) => s.replace(/([_*`[\]])/g, '\\$1');

  const lines: string[] = [
    `🟢 *New CPS lead*`,
    `*Name:* ${md(lead.name)}`,
  ];
  if (lead.phone) lines.push(`*Phone:* ${md(lead.phone)}`);
  if (lead.email) lines.push(`*Email:* ${md(lead.email)}`);
  if (lead.message) {
    const truncated = lead.message.length > 240 ? lead.message.slice(0, 240) + '…' : lead.message;
    lines.push(`*Message:* ${md(truncated)}`);
  }
  lines.push(`*Source:* ${md(lead.source)}`);
  if (lead.pageUrl) lines.push(`*Page:* ${md(lead.pageUrl)}`);

  const payload: Record<string, unknown> = {
    chat_id: TELEGRAM_CHAT_ID,
    text: lines.join('\n'),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          ...(lead.phone
            ? [{ text: '📞 Call', url: `tel:${lead.phone.replace(/[^\d+]/g, '')}` }]
            : []),
          ...(lead.email
            ? [{ text: '✉️ Email', url: `mailto:${lead.email}` }]
            : []),
        ],
        [{ text: '📊 Dashboard', url: 'https://omnileadsagi.com/dashboard/cps' }],
      ].filter((row) => row.length > 0),
    },
  };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '<no body>');
      console.error(`[cps-notify] telegram ${res.status}: ${txt.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[cps-notify] telegram fetch failed', e);
    return false;
  }
}
