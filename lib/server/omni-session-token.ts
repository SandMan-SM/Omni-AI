import { createHmac, timingSafeEqual } from "node:crypto";
import {
  decodeOmniToken,
  isOmniTokenPayloadFresh,
  OMNI_TOKEN_PATTERN,
  OMNI_TOKEN_VERSION,
  type OmniTokenPayload,
} from "../omni-token";

// Only imported by server modules. A dedicated key is optional: deployments
// already need the service-role key, from which we derive a separate signing
// key. Never fall back to a public anon key or to a hardcoded secret.
function signingKey(): Buffer | null {
  const secret = process.env.OMNI_AUTH_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret)
    .update("omni-ai/session-signing/v1")
    .digest();
}

export function signOmniToken(payload: OmniTokenPayload): string {
  if (!isOmniTokenPayloadFresh(payload)) {
    throw new Error("Cannot issue a session without a subject and future expiry");
  }
  const key = signingKey();
  if (!key) throw new Error("Omni session signing key is not configured");
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const message = `${OMNI_TOKEN_VERSION}.${encoded}`;
  const signature = createHmac("sha256", key).update(message).digest("base64url");
  const token = `${message}.${signature}`;
  if (token.length > 8192) throw new Error("Omni session payload is too large");
  return token;
}

/** Authenticate the signature BEFORE using any identity or role claim. */
export function verifyOmniToken(token: string): (OmniTokenPayload & { sub: string }) | null {
  if (typeof token !== "string" || token.length > 8192) return null;
  const match = OMNI_TOKEN_PATTERN.exec(token);
  const key = signingKey();
  if (!match || !key) return null;
  const message = `${OMNI_TOKEN_VERSION}.${match[1]}`;
  const expected = createHmac("sha256", key).update(message).digest();
  const signature = Buffer.from(match[2], "base64url");
  // Reject alternate encodings of the same signature as well as bad lengths.
  if (signature.length !== expected.length || signature.toString("base64url") !== match[2]) return null;
  if (!timingSafeEqual(expected, signature)) return null;
  const payload = decodeOmniToken(token);
  return isOmniTokenPayloadFresh(payload) ? payload : null;
}
