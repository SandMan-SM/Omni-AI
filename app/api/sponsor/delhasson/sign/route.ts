import { HOUSE_LEAD_FROM } from "@/lib/lead-sender";

// POST /api/sponsor/delhasson/sign
//
// Receives the executed sponsorship agreement from /sponsor/delhasson,
// timestamps it, persists a notification email to Sita (with the full
// selected terms + Del's typed signature), and returns 200 so the
// client surface can swap to the "Agreement executed" success state.
//
// No DB writes for v1 — Sita asked for the page first, the
// persistence layer can land in a follow-up if she wants signed
// agreements indexed in Supabase. Email is the durable record for
// now.

import { NextResponse } from "next/server";
import {
  isBotSubmission,
  isValidEmail,
  sanitizeText,
  escapeHtml,
} from "@/lib/validation";
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OWNER_EMAIL = "sitanim8@gmail.com";
const FROM_EMAIL = "Interlinked <bookings@omnios.news>";
// Sitani's pre-signed date — must match the constant in
// DelHassonClient.tsx so emailed copies cite the same date the
// signer saw on-screen.
const SITANI_DATE_LABEL = "May 22, 2026";

type Body = {
  tier?: unknown;
  amount?: unknown;
  signerName?: unknown;
  signerEmail?: unknown;
  pageUrl?: unknown;
};

function isTier(v: unknown): v is "01" | "02" | "03" {
  return v === "01" || v === "02" || v === "03";
}

// Tier minimums must match the TIER_MINIMUMS const in
// app/sponsor/_components/SignModal.tsx — client-side check
// catches it first, server-side enforces in case a client
// bypasses the front-end validator.
const TIER_MINIMUMS: Record<"01" | "02" | "03", number> = {
  "01": 1000,
  "02": 5000,
  "03": 10000,
};

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts: { replyTo?: string; from?: string } = {},
) {
  if (!RESEND_API_KEY) {
    // Email is the only record path for v1 — surface this explicitly so
    // a misconfigured RESEND key doesn't silently swallow signed
    // agreements. The route still returns 200 to the signer (their
    // signature isn't invalidated by a missing key on our side), but
    // the response includes a warning the dashboard can show.
    return { ok: false, reason: "RESEND_API_KEY missing" as const };
  }
  const payload: Record<string, unknown> = {
    from: opts.from ?? FROM_EMAIL,
    to: [to],
    subject,
    html,
  };
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `resend ${res.status}: ${text}` };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  // Rate-limit identical to the landing-lead route — 5 requests per 5
  // minutes per IP. Signing isn't a hot path, but the form is public
  // (anyone with the URL can hit it) and we don't want a spammer to
  // flood Sita's inbox if the link leaks.
  const ip = getClientIp(req.headers);
  const rl = rateLimit(
    `sponsor-delhasson-sign:${ip}`,
    5,
    5 * 60 * 1000,
  );
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const tier = body.tier;
  const amountRaw = body.amount;
  const signerNameRaw =
    typeof body.signerName === "string" ? body.signerName : "";

  if (!isTier(tier)) {
    return NextResponse.json(
      { error: "Invalid tier" },
      { status: 400 },
    );
  }
  if (typeof amountRaw !== "number" || !Number.isFinite(amountRaw) || amountRaw <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400 },
    );
  }
  const tierMin = TIER_MINIMUMS[tier];
  if (amountRaw < tierMin) {
    return NextResponse.json(
      {
        error: `Tier ${tier} minimum is $${tierMin.toLocaleString()}. Increase your contribution or pick a lower tier.`,
      },
      { status: 400 },
    );
  }
  const signerName = sanitizeText(signerNameRaw, 120);
  if (!signerName || signerName.length < 2) {
    return NextResponse.json(
      { error: "Type your full legal name to sign." },
      { status: 400 },
    );
  }
  // Signer email — required so Del receives a confirmation copy of
  // the executed terms (and so Sita's notification email has a
  // reply-to that lands in Del's inbox).
  if (!isValidEmail(body.signerEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email so we can send you a copy." },
      { status: 400 },
    );
  }
  const signerEmail = body.signerEmail.trim();

  // Honeypot — same isBotSubmission helper the landing-lead form uses.
  // Defensive even though this form doesn't ship a honeypot input;
  // future spam mitigations can plug in here without touching the
  // handler shape.
  if (isBotSubmission({ signerName })) {
    // 200 OK + silent drop so bots can't probe for the rejection
    // signature.
    return NextResponse.json({ ok: true });
  }

  const signedAt = new Date();
  const signedAtIso = signedAt.toISOString();
  const signedAtPretty = signedAt.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const ip4 = getClientIp(req.headers) || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  const amountFmt = `$${amountRaw.toLocaleString("en-US")}`;
  const tierLabels: Record<typeof tier, string> = {
    "01": "Tier 01 ($1K–$5K · up to $25K delivered)",
    "02": "Tier 02 ($5K–$10K · up to $50K delivered)",
    "03": "Tier 03 ($10K+ · up to $100K delivered + equity track)",
  };
  const html = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <p style="font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #b45309; font-weight: 700; margin: 0 0 8px;">Interlinked · Sponsor signature received</p>
      <h1 style="font-family: Georgia, serif; font-size: 26px; color: #92400e; margin: 0 0 16px; line-height: 1.2;">Del Hasson signed the sponsorship agreement.</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 20px;">Captured at <strong>${escapeHtml(signedAtPretty)}</strong>. Selected terms below — prepare the definitive paperwork and follow up within 24 hours per §8.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f; width: 38%;">Signer</td>
          <td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(signerName)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Tier</td>
          <td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(tierLabels[tier])}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Contribution</td>
          <td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937; font-weight: 700;">${escapeHtml(amountFmt)}</td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px;">Execution metadata (audit trail):</p>
      <ul style="font-size: 12px; color: #6b7280; margin: 0 0 20px; padding-left: 18px; line-height: 1.6;">
        <li>Timestamp (UTC): <code>${escapeHtml(signedAtIso)}</code></li>
        <li>Client IP: <code>${escapeHtml(ip4)}</code></li>
        <li>User agent: <code>${escapeHtml(ua.slice(0, 200))}</code></li>
        <li>Page: <code>${escapeHtml(typeof body.pageUrl === "string" ? body.pageUrl : "/sponsor/delhasson")}</code></li>
      </ul>

      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">Counter-signed by Sitani Mafi at preparation time (May 22, 2026). This summary is non-binding per §8 — definitive paperwork governs the executed relationship.</p>
    </div>
  `;

  // Del's confirmation copy — same audit-trail rows, but framed for
  // the signer's records, not Sita's CRM. Buttons explicitly avoided
  // since the email-side action surface is just "save this for your
  // records + watch your inbox for the definitive paperwork".
  const delHtml = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <p style="font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #b45309; font-weight: 700; margin: 0 0 8px;">Interlinked · by Sitani Mafi</p>
      <h1 style="font-family: Georgia, serif; font-size: 26px; color: #92400e; margin: 0 0 16px; line-height: 1.2;">Your sponsorship agreement is signed.</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 18px;">Thank you, ${escapeHtml(signerName)}. Sitani Mafi has been notified and will follow up within 24 hours with the definitive agreement and onboarding next steps, per §8. Your executed selections are below for your records.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 14px;">
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f; width: 38%;">Tier</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(tierLabels[tier])}</td></tr>
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Contribution</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937; font-weight: 700;">${escapeHtml(amountFmt)}</td></tr>
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Signed</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(signedAtPretty)}</td></tr>
      </table>

      <p style="font-size: 13px; line-height: 1.6; color: #4b5563; margin: 0 0 14px;">If anything in the selected terms needs to change before the definitive paperwork lands, simply reply to this email — Sitani will pick it up directly.</p>
      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">Counter-signed by Sitani Mafi at preparation time (${escapeHtml(SITANI_DATE_LABEL)}). This summary is non-binding per §8 — definitive paperwork will govern the executed relationship.</p>
    </div>
  `;

  // Fire both emails in parallel. We treat Sita's notification as the
  // canonical "did it land" signal (her copy is the durable record),
  // but a Del-side delivery failure isn't surfaced as a hard error —
  // the user just sees the on-screen "Agreement executed" card with
  // its 24-hour follow-up promise, and Sita can re-send the
  // confirmation manually if needed.
  const [ownerResult, delResult] = await Promise.all([
    sendEmail(
      OWNER_EMAIL,
      `Del Hasson signed · ${tierLabels[tier].split(" (")[0]} · ${amountFmt}`,
      html,
      { replyTo: signerEmail, from: HOUSE_LEAD_FROM },
    ),
    sendEmail(
      signerEmail,
      "Your Interlinked sponsorship agreement · signed copy",
      delHtml,
      { replyTo: OWNER_EMAIL },
    ),
  ]);

  return NextResponse.json({
    ok: true,
    emailDelivered: ownerResult.ok,
    signerEmailDelivered: delResult.ok,
    ...(ownerResult.ok && delResult.ok
      ? {}
      : {
          warning:
            (ownerResult.ok ? null : `owner: ${ownerResult.reason}`) ||
            (delResult.ok ? null : `signer: ${delResult.reason}`) ||
            "Email partial-failure",
        }),
  });
}
