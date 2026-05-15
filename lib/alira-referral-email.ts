// lib/alira-referral-email.ts
//
// Sends the post-payment welcome email for the Alira referral flow.
// Fires from the Stripe webhook handler (`app/api/webhooks/stripe/route.ts`)
// the moment a customer's payment clears — either the $333/mo recurring
// subscription's first invoice or the $3,000 one-time checkout session.
//
// The email is intentionally lean:
//   1. Confirms payment received
//   2. Names the wave-of-50 scarcity for social-proof
//   3. Single CTA button → Cal.com strategy meeting booking
//
// Resend is the existing transactional email rail (also used by
// lib/agi/resend.ts for outreach sends). We lazy-instantiate the client
// to avoid throwing at module load when RESEND_API_KEY isn't present
// during build-time page-data collection.

import { Resend } from "resend";

const RESEND_FROM =
  process.env.RESEND_FROM ?? "Omni AI <bookings@omnileadsagi.com>";
// Cal.com URL for the post-payment strategy meeting. Sita sets the
// real URL via OMNI_AI_STRATEGY_CAL_URL in Vercel. The placeholder
// only fires if the env var isn't set — Resend will still send the
// email, but the button will land on a 404 until Sita configures it.
const CAL_BOOKING_URL =
  process.env.OMNI_AI_STRATEGY_CAL_URL ??
  "https://cal.com/omniai/strategy-30";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Two flow flavors share this email — the $333/mo deposit and the
// $3K one-time. The body copy differs slightly (deposit mentions the
// monthly cadence; full-pay doesn't) so we pass the flow through.
export type AliraReferralFlow = "deposit" | "full";

export async function sendAliraReferralWelcomeEmail({
  to,
  customerName,
  flow,
}: {
  to: string;
  customerName?: string | null;
  flow: AliraReferralFlow;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  const subject = "Your spot is secured · Omni AI Tier-3 build";
  const html = renderHtml({
    customerName: customerName ?? "",
    calUrl: CAL_BOOKING_URL,
    flow,
  });
  const r = await client.emails.send({
    from: RESEND_FROM,
    to,
    subject,
    html,
  });
  if (r.error) {
    return { ok: false, error: String(r.error.message ?? r.error) };
  }
  return { ok: true };
}

// Branded dark-theme HTML email. Hand-crafted instead of templated
// (no MJML / react-email dep) so the file stays self-contained and
// the inline styles survive every email client's sandbox. Mirrors
// the look of the Omni AI marketing surface — black/zinc base, amber
// accent, Georgia serif headline.
function renderHtml({
  customerName,
  calUrl,
  flow,
}: {
  customerName: string;
  calUrl: string;
  flow: AliraReferralFlow;
}): string {
  const greeting = customerName ? `Welcome, ${customerName}.` : "Welcome.";
  const confirmationLine =
    flow === "deposit"
      ? "Your $333 deposit cleared and your spot in this wave is secured. The remaining payments ($333/mo over the next 8 months) run automatically — no further action needed."
      : "Your $3,000 payment cleared and your spot in this wave is secured.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your spot is secured · Omni AI</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e8e8;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#111;border:1px solid #1e1e1e;border-radius:16px;overflow:hidden;">
          <!-- Header strip -->
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.4em;text-transform:uppercase;color:#facc15;font-weight:700;">
                Omni AI · Federation
              </p>
              <h1 style="margin:14px 0 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.15;color:#ffffff;font-weight:normal;">
                ${escapeHtml(greeting)}<br/>
                <span style="color:#facc15;">Your spot is secured.</span>
              </h1>
            </td>
          </tr>

          <!-- Confirmation body -->
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#cbd5e1;">
                ${escapeHtml(confirmationLine)}
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#cbd5e1;">
                This wave we're only taking <strong style="color:#facc15;">50 businesses</strong>. You're locked in.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#cbd5e1;">
                Next step: pick a 30-minute strategy meeting slot with our team. We'll lock the kickoff calendar and start your build this week.
              </p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:28px 32px 8px 32px;" align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#facc15 0%,#f59e0b 100%);">
                    <a href="${escapeAttr(calUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:#0a0a0a;text-decoration:none;border-radius:14px;">
                      Schedule your strategy meeting &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Trust strip -->
          <tr>
            <td style="padding:8px 32px 28px 32px;" align="center">
              <p style="margin:0;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#facc15;font-weight:600;">
                AES-256 bit Advanced Encryption · Stripe-secured
              </p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #1e1e1e;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#cbd5e1;line-height:1.55;">
                — Sita Mafi
              </p>
              <p style="margin:0;font-size:12px;color:#666;">
                Founder · Omni AI
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin-top:18px;">
          <tr>
            <td align="center" style="padding:0 16px;">
              <p style="margin:0;font-size:11px;color:#555;line-height:1.55;">
                Omni AI · <a href="https://omnileadsagi.com" style="color:#facc15;text-decoration:none;">omnileadsagi.com</a>
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#555;line-height:1.55;">
                Payment confirmation also available in your Stripe receipt.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Tiny escape utilities — Resend sends the HTML verbatim, so customer-
// supplied strings need scrubbing before they land in the template.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
