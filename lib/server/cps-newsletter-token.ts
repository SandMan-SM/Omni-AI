// HMAC-signed CPS-only unsubscribe tokens. The dedicated signing context
// prevents the legacy global unsubscribe route from accepting these links.
//
// Why a custom token (vs. signed Supabase JWT or Resend's built-in):
// - Supabase JWTs require a session — recipients clicking from an
//   email don't have one.
// - Resend's tracker subdomain isn't wired (intentionally — see Round 5
//   audit note in scripts/operator-followups), so its built-in
//   unsubscribe header points at a host that doesn't resolve.
// - We just need a stateless one-click HMAC that proves "this email
//   address consented to this unsub link by virtue of receiving it."
//
// Token format: `${b64url(payload_json)}.${b64url(hmac_sha256(secret, payload_b64))}`
// Payload: { e: email, x: exp_unix_seconds, k: kind, s?: federation_site }
//
// Secret is derived from SUPABASE_SERVICE_ROLE_KEY (already in env on
// every Vercel project) — no new env var required. We hash with a
// label so a leak of the unsub secret doesn't compromise the
// service-role key, and rotating the service-role key auto-rotates
// the unsub secret (forward-compatible).

import { createHmac, createHash, timingSafeEqual } from 'crypto';

const TOKEN_KIND_NEWSLETTER = 'nl' as const;
const TOKEN_KIND_TRANSACTIONAL = 'tx' as const;
type TokenKind = typeof TOKEN_KIND_NEWSLETTER | typeof TOKEN_KIND_TRANSACTIONAL;

const DEFAULT_TTL_DAYS = 365; // 1-year window — recipients keep emails forever

function getSecret(): Buffer {
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OMNI_UNSUB_SECRET || '';
  if (!seed) {
    throw new Error(
      '[unsubscribe-token] No SUPABASE_SERVICE_ROLE_KEY or OMNI_UNSUB_SECRET in env',
    );
  }
  return createHash('sha256').update('cps-newsletter-unsub-v1\u0000').update(seed).digest();
}

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signUnsubscribeToken(
  email: string,
  kind: TokenKind = TOKEN_KIND_NEWSLETTER,
  ttlDays = DEFAULT_TTL_DAYS,
  site?: string,
  expiresAtUnixSeconds?: number,
): string {
  const normalizedSite = site?.trim().toLowerCase();
  if (normalizedSite && !/^[a-z0-9-]{1,64}$/.test(normalizedSite)) {
    throw new Error('[unsubscribe-token] Invalid federation site');
  }
  const payload = {
    e: email.toLowerCase().trim(),
    x:
      Number.isSafeInteger(expiresAtUnixSeconds) &&
      (expiresAtUnixSeconds as number) > 0
        ? (expiresAtUnixSeconds as number)
        : Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
    k: kind,
    ...(normalizedSite ? { s: normalizedSite } : {}),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export type VerifiedUnsubscribe =
  | { ok: true; email: string; kind: TokenKind; site?: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'no_secret' };

export function verifyUnsubscribeToken(token: string): VerifiedUnsubscribe {
  if (!token || typeof token !== 'string' || token.length > 4096 || token.split('.').length !== 2) {
    return { ok: false, reason: 'malformed' };
  }
  const [payloadB64, sigB64] = token.split('.', 2);
  if (!payloadB64 || !sigB64) return { ok: false, reason: 'malformed' };

  let secret: Buffer;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: 'no_secret' };
  }

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (providedSig.length !== expectedSig.length) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (!timingSafeEqual(providedSig, expectedSig)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: { e?: unknown; x?: unknown; k?: unknown; s?: unknown };
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof payload.e !== 'string' || typeof payload.x !== 'number' || typeof payload.k !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  if (Math.floor(Date.now() / 1000) > payload.x) {
    return { ok: false, reason: 'expired' };
  }
  if (payload.k !== TOKEN_KIND_NEWSLETTER && payload.k !== TOKEN_KIND_TRANSACTIONAL) {
    return { ok: false, reason: 'malformed' };
  }
  if (
    payload.s !== undefined &&
    (typeof payload.s !== 'string' || !/^[a-z0-9-]{1,64}$/.test(payload.s))
  ) {
    return { ok: false, reason: 'malformed' };
  }
  return {
    ok: true,
    email: payload.e,
    kind: payload.k as TokenKind,
    ...(typeof payload.s === 'string' ? { site: payload.s } : {}),
  };
}

/**
 * Build a one-click unsubscribe URL pointing at /api/newsletter/unsubscribe.
 * Use the returned URL both as the visible "unsubscribe" link in the
 * email body AND as the value of the `List-Unsubscribe` header so
 * Gmail / Apple Mail honour the one-click standard (RFC 8058).
 */
export function buildUnsubscribeUrl(
  email: string,
  siteUrl: string,
  kind: TokenKind = TOKEN_KIND_NEWSLETTER,
): string {
  const token = signUnsubscribeToken(email, kind);
  return `${siteUrl.replace(/\/$/, '')}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Build a publication-scoped federation unsubscribe URL. The site is part of
 * the signed token so changing the query string cannot unsubscribe another
 * publication.
 */
export function buildFederationUnsubscribeUrl(
  email: string,
  site: string,
  federationUrl = 'https://omnileadsagi.com',
  expiresAtUnixSeconds?: number,
): string {
  const token = signUnsubscribeToken(
    email,
    TOKEN_KIND_NEWSLETTER,
    DEFAULT_TTL_DAYS,
    site,
    expiresAtUnixSeconds,
  );
  return `${federationUrl.replace(/\/$/, '')}/api/inbound/cps/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

