import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Bearer-secret gate for the voice-agent TOOL routes (availability / book /
// capture-lead). ElevenLabs sends this as `Authorization: Bearer <secret>` via
// the tool's request_headers (backed by a workspace secret). We deliberately do
// NOT reuse authorizeCronOrAdmin here: the voice platform must never hold the
// powerful CRON_SECRET/ADMIN key — it gets its own scoped secret whose only
// power is to create leads + book the free strategy call.
//
// Env: VOICE_AGENT_SECRET (set in Vercel + mirrored as an ElevenLabs workspace
// secret). If unset, the routes fail closed (401) so they can't be abused
// before the secret is configured.
export function verifyVoiceToolAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.VOICE_AGENT_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "voice_agent_not_configured" },
      { status: 401 },
    );
  }

  const header = req.headers.get("authorization") || "";
  const presented = header.replace(/^Bearer\s+/i, "").trim();
  if (!presented || !constantTimeEqual(presented, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// Verify an ElevenLabs post-call webhook signature.
// Header `ElevenLabs-Signature: t=<unix>,v0=<hex>`; signed message is
// `${t}.${rawBody}` under HMAC-SHA256 with the webhook's shared secret.
// Reject stale timestamps (replay guard). Pass the RAW request text — never a
// re-serialized JSON body, or the bytes won't match the signature.
export function verifyElevenLabsSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 30 * 60,
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
    }),
  ) as { t?: string; v0?: string };

  if (!parts.t || !parts.v0) return false;

  const ts = Number(parts.t);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const expected =
    "v0=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${parts.t}.${rawBody}`)
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v0.startsWith("v0=") ? parts.v0 : `v0=${parts.v0}`);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
