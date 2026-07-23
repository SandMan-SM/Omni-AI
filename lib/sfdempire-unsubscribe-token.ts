import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const SITE = "sfdempire";
const DEFAULT_TTL_DAYS = 365;

type TokenPayload = {
  e: string;
  s: typeof SITE;
  x: number;
};

export type VerifiedSfdUnsubscribe =
  | { ok: true; email: string; site: typeof SITE }
  | {
      ok: false;
      reason: "malformed" | "bad_signature" | "expired" | "no_secret";
    };

function secret(): Buffer {
  const seed =
    process.env.OMNI_UNSUB_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!seed) throw new Error("sfd_unsubscribe_secret_not_configured");
  return createHash("sha256")
    .update("sfdempire-site-unsubscribe-v1\0")
    .update(seed)
    .digest();
}

function encode(value: Buffer | string): string {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value, "utf8");
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decode(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "===".slice((normalized.length + 3) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
}

export function signSfdUnsubscribeToken(
  email: string,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const payload: TokenPayload = {
    e: email.toLowerCase().trim(),
    s: SITE,
    x: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret())
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${encode(signature)}`;
}

export function verifySfdUnsubscribeToken(
  token: string,
): VerifiedSfdUnsubscribe {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [encodedPayload, encodedSignature] = token.split(".", 2);
  if (!encodedPayload || !encodedSignature) {
    return { ok: false, reason: "malformed" };
  }

  let signingSecret: Buffer;
  try {
    signingSecret = secret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }

  const expected = createHmac("sha256", signingSecret)
    .update(encodedPayload)
    .digest();
  let provided: Buffer;
  try {
    provided = decode(encodedSignature);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: Partial<TokenPayload>;
  try {
    payload = JSON.parse(decode(encodedPayload).toString("utf8")) as Partial<TokenPayload>;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof payload.e !== "string" ||
    typeof payload.x !== "number" ||
    payload.s !== SITE
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (Math.floor(Date.now() / 1000) > payload.x) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    email: payload.e.toLowerCase().trim(),
    site: SITE,
  };
}

export function buildSfdUnsubscribeUrl(email: string): string {
  const receiverUrl =
    process.env.SFD_FORMS_PUBLIC_URL || "https://omnileadsagi.com";
  const token = signSfdUnsubscribeToken(email);
  return `${receiverUrl.replace(/\/$/, "")}/api/inbound/sfdempire/forms/unsubscribe?token=${encodeURIComponent(token)}`;
}
