// Owner notification for voice-receptionist events, via Resend. Shares the
// single lead sending identity with every other form on the fabric — see
// lib/lead-sender.ts. Fire-and-forget; a failed notify never blocks a live call
// or a booking.
import { HOUSE_LEAD_FROM } from "@/lib/lead-sender";

const OWNER_EMAIL = process.env.NEWSLETTER_TO_EMAIL || "sitanim8@gmail.com";
const FROM = HOUSE_LEAD_FROM;

export async function emailOwner(opts: {
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [OWNER_EMAIL],
        reply_to: opts.replyTo || "alfred@omnileadsagi.com",
        subject: opts.subject,
        html: opts.html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[voice/notify] resend failed:", res.status, (await res.text()).slice(0, 200));
    }
  } catch (e) {
    console.error("[voice/notify] resend error:", e);
  } finally {
    clearTimeout(timeout);
  }
}

// Minimal dark-theme card matching the brand's transactional email look.
export function ownerCard(kicker: string, title: string, rows: Array<[string, string]>, note?: string): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="color:#9ca3af;font-size:12px;padding:4px 12px 4px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="color:#ffffff;font-size:13px;padding:4px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `
<div style="max-width:560px;margin:0 auto;padding:32px 20px;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <p style="color:#a855f7;font-size:12px;font-weight:700;letter-spacing:1px;margin:0 0 4px;">OMNI AI · ${escapeHtml(kicker)}</p>
  <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 20px;">${escapeHtml(title)}</h1>
  <table cellpadding="0" cellspacing="0" style="margin-bottom:${note ? "16px" : "0"};">${body}</table>
  ${note ? `<p style="color:#d1d5db;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #2a2a2a;padding-top:14px;">${escapeHtml(note)}</p>` : ""}
</div>`.trim();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
