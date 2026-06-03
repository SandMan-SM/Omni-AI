import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import {
  DOCUMENT_SIGNATURE_CREDIT,
  getDocumentSignatureDefinition,
  type DocumentSignatureDefinition,
} from "@/lib/document-signatures";
import { resolveAccountUser } from "@/lib/server/account-user";
import {
  findDocumentSignature,
  persistDocumentSignature,
  updateDocumentSignatureEmailResult,
  type DocumentSignatureEmailResult,
  type DocumentSignatureRecord,
} from "@/lib/server/document-signatures";
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

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL =
  process.env.OMNI_PROGRAM_FROM_EMAIL ||
  process.env.RESEND_FROM ||
  "Alfred Belvedere <alfred@omnileadsagi.com>";
const MAFI_EMAIL = process.env.OMNI_PROGRAM_MAFI_CC || "sitanim8@gmail.com";

type Body = {
  documentSlug?: unknown;
  signerName?: unknown;
  signatureName?: unknown;
  signerEmail?: unknown;
  email?: unknown;
  pageUrl?: unknown;
  website?: unknown;
  url?: unknown;
  hp?: unknown;
};

type HandlerOptions = {
  fallbackDocumentSlug?: string;
};

function uniqueCcList(to: string) {
  const toLower = to.toLowerCase();
  return [MAFI_EMAIL].filter((email, index, all) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized === toLower) return false;
    return (
      all.findIndex((item) => item.trim().toLowerCase() === normalized) ===
      index
    );
  });
}

function signatureResponse(params: {
  definition: DocumentSignatureDefinition;
  signature: DocumentSignatureRecord | null;
  alreadySigned: boolean;
  creditAwardedNow?: number;
  emailStatus?: DocumentSignatureEmailResult["emailStatus"];
  status?: string;
  message?: string;
}) {
  const { definition, signature } = params;
  return {
    ok: true,
    signed: Boolean(signature),
    alreadySigned: params.alreadySigned,
    signatureId: signature?.id || null,
    documentSlug: definition.slug,
    documentTitle: definition.title,
    signerName: signature?.signerName || null,
    signerEmail: signature?.signerEmail || null,
    signedAt: signature?.signedAt || null,
    creditAwarded: signature?.creditAwarded || 0,
    creditAwardedNow: params.creditAwardedNow ?? 0,
    emailStatus: params.emailStatus || signature?.emailStatus || null,
    status: params.status,
    message: params.message,
  };
}

function acknowledgementEmailHtml(params: {
  signerName: string;
  documentTitle: string;
  creditAwarded: number;
  signedAt: Date;
}) {
  const name = escapeHtml(params.signerName);
  const documentTitle = escapeHtml(params.documentTitle);
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
        <p style="margin:0 0 14px;color:#facc15;font-size:11px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;">Omni AI · Document acknowledgement</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:38px;line-height:1.05;color:#ffffff;">Your acknowledgement has been recorded.</h1>
        <p style="margin:0 0 24px;color:#d4d4d8;font-size:17px;line-height:1.7;">${name}, you signed ${documentTitle} on ${signedAt}. The system has logged your commitment and advanced your Omni credit ledger by <strong style="color:#fde68a;">+${creditAwarded} credits</strong>.</p>
        <div style="border:1px solid rgba(250,204,21,.28);background:linear-gradient(135deg,rgba(250,204,21,.10),rgba(56,189,248,.06));border-radius:12px;padding:22px;margin:26px 0;">
          <p style="margin:0 0 10px;color:#fef3c7;font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Debrief from Alfred Belvedere</p>
          <p style="margin:0;color:#e5e7eb;font-size:16px;line-height:1.75;">You did not just read a document. You marked a threshold. The signature is now a reference point: when the loop appears, return to the signal; when noise asks for obedience, protect the channel; when the old self negotiates, act before it reclaims the room.</p>
          <p style="margin:18px 0 0;color:#e5e7eb;font-size:16px;line-height:1.75;">The credit is symbolic and operational: +${creditAwarded} for choosing conscious architecture over passive drift. Spend it by living the next decision cleaner than the last one.</p>
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
  documentTitle: string;
  creditAwarded: number;
  signedAt: Date;
}): Promise<DocumentSignatureEmailResult> {
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
        subject: `+${params.creditAwarded} Omni credits added · ${params.documentTitle}`,
        html: acknowledgementEmailHtml(params),
        text:
          `${params.signerName}, your ${params.documentTitle} acknowledgement has been recorded.\n\n` +
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
      emailStatus:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "failed",
      emailError: error instanceof Error ? error.message : "email send failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveDocument(
  value: unknown,
  options?: HandlerOptions,
): DocumentSignatureDefinition | null {
  if (typeof value === "string" && value.trim()) {
    return getDocumentSignatureDefinition(value);
  }
  return (
    getDocumentSignatureDefinition(options?.fallbackDocumentSlug) ||
    getDocumentSignatureDefinition("omni-program")
  );
}

export async function handleDocumentSignatureGet(
  req: Request,
  options?: HandlerOptions,
) {
  noStore();

  const url = new URL(req.url);
  const definition = resolveDocument(url.searchParams.get("documentSlug"), options);
  if (!definition) {
    return NextResponse.json(
      { error: "Unsupported document slug." },
      { status: 400 },
    );
  }

  const user = await resolveAccountUser(req);
  if (!user) {
    return NextResponse.json(
      {
        signed: false,
        alreadySigned: false,
        documentSlug: definition.slug,
        documentTitle: definition.title,
        creditAwarded: 0,
        error: "Sign in before checking this document.",
      },
      { status: 401 },
    );
  }

  const signature = await findDocumentSignature(user.id, definition.slug);
  return NextResponse.json(
    signatureResponse({
      definition,
      signature,
      alreadySigned: Boolean(signature),
    }),
  );
}

export async function handleDocumentSignaturePost(
  req: Request,
  options?: HandlerOptions,
) {
  noStore();

  const user = await resolveAccountUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in before signing the document." },
      { status: 401 },
    );
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(
    `document-signatures:${user.id}:${ip}`,
    8,
    10 * 60 * 1000,
  );
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

  const definition = resolveDocument(body.documentSlug, options);
  if (!definition) {
    return NextResponse.json(
      { error: "Unsupported document slug." },
      { status: 400 },
    );
  }

  const existing = await findDocumentSignature(user.id, definition.slug);
  if (existing) {
    return NextResponse.json(
      signatureResponse({
        definition,
        signature: existing,
        alreadySigned: true,
        creditAwardedNow: 0,
        status: "direct-postgres-existing",
        message:
          "This document is already sealed to your Omni account. No duplicate credit event was created.",
      }),
    );
  }

  const signerName = sanitizeText(
    body.signerName || body.signatureName || user.name || user.username || "",
    160,
  );
  const signerEmail = sanitizeText(
    user.email || body.signerEmail || body.email,
    254,
  ).toLowerCase();
  const pageUrl = sanitizeText(body.pageUrl || definition.path, 500);
  const signedAt = new Date();

  if (signerName.length < 2) {
    return NextResponse.json(
      { error: "Type your name to sign." },
      { status: 400 },
    );
  }

  if (!isValidEmail(signerEmail)) {
    return NextResponse.json(
      { error: "Your Omni account needs a valid email before signing." },
      { status: 400 },
    );
  }

  const result = await persistDocumentSignature({
    id: randomUUID(),
    userId: user.id,
    signerName,
    signerEmail,
    documentSlug: definition.slug,
    documentTitle: definition.title,
    pageUrl,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || null,
    raw: {
      documentSlug: definition.slug,
      documentTitle: definition.title,
      creditAwarded: DOCUMENT_SIGNATURE_CREDIT,
      connector: "docusign",
      docusignStatus: "connector-unavailable",
      pageUrl,
    },
    creditAwarded: DOCUMENT_SIGNATURE_CREDIT,
  });

  if (!result.persisted || !result.signature) {
    return NextResponse.json(
      {
        error:
          "Signature capture is temporarily unavailable. Try again in a moment.",
        status: result.status,
      },
      { status: 503 },
    );
  }

  if (result.alreadySigned) {
    return NextResponse.json(
      signatureResponse({
        definition,
        signature: result.signature,
        alreadySigned: true,
        creditAwardedNow: 0,
        status: result.status,
        message:
          "This document is already sealed to your Omni account. No duplicate credit event was created.",
      }),
    );
  }

  const emailResult = await sendAcknowledgementEmail({
    signerName,
    signerEmail,
    documentTitle: definition.title,
    creditAwarded: DOCUMENT_SIGNATURE_CREDIT,
    signedAt,
  });
  await updateDocumentSignatureEmailResult(result.signature.id, emailResult);

  return NextResponse.json(
    signatureResponse({
      definition,
      signature: {
        ...result.signature,
        emailStatus: emailResult.emailStatus,
        emailMessageId: emailResult.emailMessageId || null,
        emailError: emailResult.emailError || null,
      },
      alreadySigned: false,
      creditAwardedNow: DOCUMENT_SIGNATURE_CREDIT,
      emailStatus: emailResult.emailStatus,
      status: result.status,
      message:
        emailResult.emailStatus === "sent"
          ? `Acknowledgement received. +${DOCUMENT_SIGNATURE_CREDIT} Omni credits have been added, and Alfred Belvedere's debrief has been sent.`
          : `Acknowledgement received. +${DOCUMENT_SIGNATURE_CREDIT} Omni credits have been added. Alfred Belvedere's debrief is queued in the system record.`,
    }),
    { status: 201 },
  );
}
