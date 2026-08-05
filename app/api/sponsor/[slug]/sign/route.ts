// POST /api/sponsor/[slug]/sign
//
// Dynamic catch-all for every sponsorship-signing surface. The
// SignModal on /sponsor/{slug} and /sponsor/{slug}/info posts
// here with the sponsorship terms; this handler validates,
// rate-limits, and fires the dual-email notification (Sita's
// CRM copy + the signer's confirmation copy) via Resend.
//
// Was a static /api/sponsor/delhasson/sign route bespoke to Del;
// the original lives at app/api/sponsor/delhasson/sign/route.ts
// as a safety net (and that file is what Del's modal currently
// POSTs to — Del's wrapper passes signEndpoint="/api/sponsor/
// delhasson/sign"). New sponsors (Debbie / Landon / Blake /
// Joshua / James / Setefano / Supileo / Nele) all POST to this
// dynamic route with their slug in the URL.
//
// The slug is validated against an explicit whitelist below; any
// other value returns 404 so the route can't be hit with garbage.
// Each whitelisted entry carries the sponsor's display name + the
// Sitani-signed date so the email body renders correctly.

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

// Sponsor whitelist — every slug that the dynamic route accepts.
// Adding a new sponsor is two lines here + one new app/sponsor/
// {slug}/page.tsx + one new app/sponsor/{slug}/info/page.tsx.
// `sitaniSignedDate` must match the prop passed to SignModal on
// that sponsor's pages so the emailed copy cites the same date
// the signer saw on-screen.
const SPONSOR_REGISTRY: Record<
  string,
  { displayName: string; sitaniSignedDate: string }
> = {
  delhasson: {
    displayName: "Del Hasson",
    sitaniSignedDate: "May 22, 2026",
  },
  debbiebiery: {
    displayName: "Debbie Biery",
    sitaniSignedDate: "May 25, 2026",
  },
  landonhasson: {
    displayName: "Landon Hasson",
    sitaniSignedDate: "May 25, 2026",
  },
  blakehasson: {
    displayName: "Blake Hasson",
    sitaniSignedDate: "May 25, 2026",
  },
  joshuaelkington: {
    displayName: "Joshua Elkington",
    sitaniSignedDate: "May 25, 2026",
  },
  jamesball: {
    displayName: "James Ball",
    sitaniSignedDate: "May 25, 2026",
  },
  setefanomafi: {
    displayName: "Setefano Mafi",
    sitaniSignedDate: "May 25, 2026",
  },
  supileomafi: {
    displayName: "Supileo Mafi",
    sitaniSignedDate: "May 25, 2026",
  },
  nelemafi: {
    displayName: "Nele Mafi",
    sitaniSignedDate: "May 25, 2026",
  },
};

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
  opts: { replyTo?: string } = {},
) {
  if (!RESEND_API_KEY) {
    return { ok: false, reason: "RESEND_API_KEY missing" as const };
  }
  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
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

type RouteContext = { params: { slug: string } };

export async function POST(req: Request, context: RouteContext) {
  const slug = (context.params.slug || "").toLowerCase();
  const sponsor = SPONSOR_REGISTRY[slug];
  if (!sponsor) {
    return NextResponse.json(
      { error: "Unknown sponsor" },
      { status: 404 },
    );
  }

  // Rate-limit namespaced per slug so abuse on one sponsor's
  // surface doesn't lock anyone out of another's.
  const ip = getClientIp(req.headers);
  const rl = rateLimit(
    `sponsor-${slug}-sign:${ip}`,
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
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (
    typeof amountRaw !== "number" ||
    !Number.isFinite(amountRaw) ||
    amountRaw <= 0
  ) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
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
  if (!isValidEmail(body.signerEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email so we can send you a copy." },
      { status: 400 },
    );
  }
  const signerEmail = body.signerEmail.trim();

  if (isBotSubmission({ signerName })) {
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
    "03": "Tier 03 ($10K+ · up to $100K delivered)",
  };

  const ownerHtml = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <p style="font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #b45309; font-weight: 700; margin: 0 0 8px;">Interlinked · Sponsor signature received</p>
      <h1 style="font-family: Georgia, serif; font-size: 26px; color: #92400e; margin: 0 0 16px; line-height: 1.2;">${escapeHtml(sponsor.displayName)} signed the sponsorship agreement.</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 20px;">Captured at <strong>${escapeHtml(signedAtPretty)}</strong>. Selected terms below — prepare the definitive paperwork and follow up within 24 hours per §8.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 14px;">
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f; width: 38%;">Signer</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(signerName)}</td></tr>
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Tier</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937;">${escapeHtml(tierLabels[tier])}</td></tr>
        <tr><td style="padding: 10px 12px; background: #fef3c7; border: 1px solid #fde68a; font-weight: 700; color: #78350f;">Contribution</td><td style="padding: 10px 12px; border: 1px solid #fde68a; color: #1f2937; font-weight: 700;">${escapeHtml(amountFmt)}</td></tr>
      </table>

      <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px;">Execution metadata (audit trail):</p>
      <ul style="font-size: 12px; color: #6b7280; margin: 0 0 20px; padding-left: 18px; line-height: 1.6;">
        <li>Sponsor slug: <code>${escapeHtml(slug)}</code></li>
        <li>Timestamp (UTC): <code>${escapeHtml(signedAtIso)}</code></li>
        <li>Client IP: <code>${escapeHtml(ip4)}</code></li>
        <li>User agent: <code>${escapeHtml(ua.slice(0, 200))}</code></li>
        <li>Page: <code>${escapeHtml(typeof body.pageUrl === "string" ? body.pageUrl : `/sponsor/${slug}`)}</code></li>
      </ul>

      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">Counter-signed by Sitani Mafi at preparation time (${escapeHtml(sponsor.sitaniSignedDate)}). This summary is non-binding per §8 — definitive paperwork governs the executed relationship.</p>
    </div>
  `;

  const signerHtml = `
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
      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">Counter-signed by Sitani Mafi at preparation time (${escapeHtml(sponsor.sitaniSignedDate)}). This summary is non-binding per §8 — definitive paperwork will govern the executed relationship.</p>
    </div>
  `;

  const [ownerResult, signerResult] = await Promise.all([
    sendEmail(
      OWNER_EMAIL,
      `${sponsor.displayName} signed · ${tierLabels[tier].split(" (")[0]} · ${amountFmt}`,
      ownerHtml,
      { replyTo: signerEmail },
    ),
    sendEmail(
      signerEmail,
      "Your Interlinked sponsorship agreement · signed copy",
      signerHtml,
      { replyTo: OWNER_EMAIL },
    ),
  ]);

  return NextResponse.json({
    ok: true,
    emailDelivered: ownerResult.ok,
    signerEmailDelivered: signerResult.ok,
    ...(ownerResult.ok && signerResult.ok
      ? {}
      : {
          warning:
            (ownerResult.ok ? null : `owner: ${ownerResult.reason}`) ||
            (signerResult.ok ? null : `signer: ${signerResult.reason}`) ||
            "Email partial-failure",
        }),
  });
}
