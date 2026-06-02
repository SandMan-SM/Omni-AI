import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { decodeOmniToken, isOmniTokenPayloadFresh } from "@/lib/omni-token";
import {
  persistOmniProgramSignature,
  updateOmniProgramSignatureEmailResult,
  type OmniProgramSignatureEmailResult,
} from "@/lib/server/omni-program-signatures";
import {
  escapeHtml,
  isBotSubmission,
  isValidEmail,
  sanitizeText,
} from "@/lib/validation";
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CREDIT_AWARD = 10;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL =
  process.env.OMNI_PROGRAM_FROM_EMAIL ||
  process.env.RESEND_FROM ||
  "Alfred Belvedere <alfred@omnileadsagi.com>";
const MAFI_EMAIL = process.env.OMNI_PROGRAM_MAFI_CC || "sitanim8@gmail.com";

type Body = {
  signerName?: unknown;
  signatureName?: unknown;
  signerEmail?: unknown;
  email?: unknown;
  pageUrl?: unknown;
  website?: unknown;
  url?: unknown;
  hp?: unknown;
};

function resolveUserId(req: Request) {
  const bearer = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!bearer) return null;
  const payload = decodeOmniToken(bearer);
  if (!isOmniTokenPayloadFresh(payload)) return null;
  return typeof payload.sub === "string" ? payload.sub : null;
}

function uniqueCcList(to: string) {
  const toLower = to.toLowerCase();
  return [MAFI_EMAIL].filter((email, index, all) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized === toLower) return false;
    return all.findIndex((item) => item.trim().toLowerCase() === normalized) === index;
  });
}

function acknowledgementEmailHtml(params: {
  signerName: string;
  creditAwarded: number;
  signedAt: Date;
}) {
  const name = escapeHtml(params.signerName);
  const creditAwarded = escapeHtml(String(params.creditAwarded));
  const signedAt = escapeHtml(
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Denver",
    }).format(params.signedAt),
  );

  return `
    <div style="margin:0;padding:0;background:#050506;color:#f5f5f4;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:36px 22px;">
        <p style="margin:0 0 14px;color:#facc15;font-size:11px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;">Omni AI · Program acknowledgement</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:38px;line-height:1.05;color:#ffffff;">Your acknowledgement has been recorded.</h1>
        <p style="margin:0 0 24px;color:#d4d4d8;font-size:17px;line-height:1.7;">${name}, you signed The Omni Program on ${signedAt}. The system has logged your commitment and advanced your Omni credit ledger by <strong style="color:#fde68a;">+${creditAwarded} credits</strong>.</p>
        <div style="border:1px solid rgba(250,204,21,.28);background:linear-gradient(135deg,rgba(250,204,21,.10),rgba(56,189,248,.06));border-radius:12px;padding:22px;margin:26px 0;">
          <p style="margin:0 0 10px;color:#fef3c7;font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Debrief from Alfred Belvedere</p>
          <p style="margin:0;color:#e5e7eb;font-size:16px;line-height:1.75;">You did not just read a document. You marked a threshold. The Program is now a reference point: when the loop appears, return to the signal; when noise asks for obedience, protect the channel; when the old self negotiates, act before it reclaims the room.</p>
          <p style="margin:18px 0 0;color:#e5e7eb;font-size:16px;line-height:1.75;">The credit is symbolic and operational: +10 for choosing conscious architecture over passive drift. Spend it by living the next decision cleaner than the last one.</p>
        </div>
        <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.7;">This acknowledgement was CC'd to $Mafi for the Omni AI record.</p>
        <p style="margin:28px 0 0;color:#ffffff;font-size:15px;line-height:1.7;">Alfred Belvedere<br/><span style="color:#a1a1aa;">Founder, Omni AI</span></p>
      </div>
    </div>
  `;
}

async function sendAcknowledgementEmail(params: {
  signerName: string;
  signerEmail: string;
  creditAwarded: number;
  signedAt: Date;
}): Promise<OmniProgramSignatureEmailResult> {
  if (!RESEND_API_KEY) {
    return {
      emailStatus: "skipped",
      emailError: "RESEND_API_KEY missing",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.signerEmail,
        cc: uniqueCcList(params.signerEmail),
        reply_to: "alfred@omnileadsagi.com",
        subject: `+${params.creditAwarded} Omni credits added · The Omni Program`,
        html: acknowledgementEmailHtml(params),
        text:
          `${params.signerName}, your Omni Program acknowledgement has been recorded.\n\n` +
          `+${params.creditAwarded} credits have been added to your credit with Omni AI.\n\n` +
          "Debrief from Alfred Belvedere: You marked a threshold. Return to the signal, protect the channel, and act before the old loop reclaims the room.",
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return {
        emailStatus: "failed",
        emailError: `Resend ${res.status}: ${text.slice(0, 280)}`,
      };
    }

    let parsed: { id?: string } = {};
    try {
      parsed = JSON.parse(text) as { id?: string };
    } catch {
      parsed = {};
    }

    return {
      emailStatus: "sent",
      emailMessageId: parsed.id || null,
    };
  } catch (error) {
    return {
      emailStatus: error instanceof Error && error.name === "AbortError" ? "timeout" : "failed",
      emailError: error instanceof Error ? error.message : "email send failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  noStore();

  const userId = resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in before signing the document." },
      { status: 401 },
    );
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`omni-program-sign:${userId}:${ip}`, 4, 10 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (isBotSubmission(body as Record<string, unknown>)) {
    return NextResponse.json({ ok: true });
  }

  const signerName = sanitizeText(body.signerName || body.signatureName, 160);
  const signerEmail = sanitizeText(body.signerEmail || body.email, 254).toLowerCase();
  const pageUrl = sanitizeText(body.pageUrl, 500);
  const signedAt = new Date();

  if (signerName.length < 2) {
    return NextResponse.json(
      { error: "Type your name to sign." },
      { status: 400 },
    );
  }

  if (!isValidEmail(signerEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  }

  const signatureId = randomUUID();
  const result = await persistOmniProgramSignature({
    id: signatureId,
    userId,
    signerName,
    signerEmail,
    documentSlug: "omni-program",
    documentTitle: "The Omni Program",
    pageUrl,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || null,
    raw: {
      document: "The Omni Program",
      creditAwarded: CREDIT_AWARD,
      connector: "docusign",
      docusignStatus: "connector-unavailable",
      pageUrl,
    },
    creditAwarded: CREDIT_AWARD,
  });

  if (result.status === "direct-postgres-unavailable") {
    return NextResponse.json(
      {
        error: "Signature capture is temporarily unavailable. Try again in a moment.",
        signatureId,
        docusignStatus: result.docusignStatus,
      },
      { status: 503 },
    );
  }

  const emailResult = await sendAcknowledgementEmail({
    signerName,
    signerEmail,
    creditAwarded: CREDIT_AWARD,
    signedAt,
  });
  await updateOmniProgramSignatureEmailResult(signatureId, emailResult);

  return NextResponse.json(
    {
      ok: true,
      signatureId: result.signatureId,
      persisted: result.persisted,
      status: result.status,
      creditAwarded: CREDIT_AWARD,
      emailStatus: emailResult.emailStatus,
      docusignStatus: result.docusignStatus,
      message:
        emailResult.emailStatus === "sent"
          ? `Acknowledgement received. The Omni ledger has advanced: +${CREDIT_AWARD} credits have been added to your credit with Omni AI, and Alfred Belvedere's debrief has been sent.`
          : `Acknowledgement received. The Omni ledger has advanced: +${CREDIT_AWARD} credits have been added to your credit with Omni AI. Alfred Belvedere's debrief is queued in the system record.`,
    },
    { status: result.persisted ? 201 : 202 },
  );
}
