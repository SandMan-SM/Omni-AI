// HMAC-signed approve/reject tokens for federation newsletter drafts.
//
// Mirrors the unsubscribe-token.ts pattern (same SUPABASE_SERVICE_ROLE_KEY-
// derived secret, same b64url encoding, same timing-safe equal). Different
// label so a leak of one secret doesn't compromise the other, and different
// kinds so a stolen approve token can't be replayed as an unsubscribe.
//
// Token format: `${b64url(payload_json)}.${b64url(hmac_sha256(secret, payload_b64))}`
// Payload: { p: post_id_uuid, s: site_slug, x: exp_unix_seconds, k: 'na' | 'nr' }
//   k='na' → newsletter-approve, k='nr' → newsletter-reject
//
// Tokens are single-purpose by `k`. Click "Approve" → server only flips the
// row when k==='na'. Same payload re-signed with k='nr' produces the reject
// link. Both go in the same draft email so the operator can either confirm
// or discard with one click.

import { createHmac, createHash, timingSafeEqual } from 'crypto';

const KIND_APPROVE = 'na' as const;
const KIND_REJECT = 'nr' as const;
export type FederationNewsletterTokenKind =
  | typeof KIND_APPROVE
  | typeof KIND_REJECT;

const DEFAULT_TTL_DAYS = 7; // drafts go stale fast — operator either acts
                            // on today's draft today or it's no longer
                            // relevant to "today."

function getSecret(): Buffer {
  const seed =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.OMNI_FEDERATION_NEWSLETTER_SECRET ||
    '';
  if (!seed) {
    throw new Error(
      '[federation-newsletter-tokens] No SUPABASE_SERVICE_ROLE_KEY or OMNI_FEDERATION_NEWSLETTER_SECRET in env',
    );
  }
  return createHash('sha256')
    .update('omni-federation-newsletter-v1 ')
    .update(seed)
    .digest();
}

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  const padded =
    s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signFederationNewsletterToken(
  postId: string,
  site: string,
  kind: FederationNewsletterTokenKind,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const payload = {
    p: postId,
    s: site,
    x: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
    k: kind,
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export type VerifiedFederationNewsletterToken =
  | {
      ok: true;
      postId: string;
      site: string;
      kind: FederationNewsletterTokenKind;
    }
  | {
      ok: false;
      reason:
        | 'malformed'
        | 'bad_signature'
        | 'expired'
        | 'no_secret'
        | 'wrong_kind';
    };

export function verifyFederationNewsletterToken(
  token: string,
  expectedKind?: FederationNewsletterTokenKind,
): VerifiedFederationNewsletterToken {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
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

  let payload: { p?: unknown; s?: unknown; x?: unknown; k?: unknown };
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload.p !== 'string' ||
    typeof payload.s !== 'string' ||
    typeof payload.x !== 'number' ||
    typeof payload.k !== 'string'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (Math.floor(Date.now() / 1000) > payload.x) {
    return { ok: false, reason: 'expired' };
  }
  if (payload.k !== KIND_APPROVE && payload.k !== KIND_REJECT) {
    return { ok: false, reason: 'malformed' };
  }
  if (expectedKind && payload.k !== expectedKind) {
    return { ok: false, reason: 'wrong_kind' };
  }
  return {
    ok: true,
    postId: payload.p,
    site: payload.s,
    kind: payload.k as FederationNewsletterTokenKind,
  };
}

export function buildApproveUrl(
  postId: string,
  site: string,
  baseUrl = 'https://omnileadsagi.com',
): string {
  const token = signFederationNewsletterToken(postId, site, KIND_APPROVE);
  return `${baseUrl.replace(/\/$/, '')}/api/federation-newsletter/approve?token=${encodeURIComponent(token)}`;
}

export function buildRejectUrl(
  postId: string,
  site: string,
  baseUrl = 'https://omnileadsagi.com',
): string {
  const token = signFederationNewsletterToken(postId, site, KIND_REJECT);
  return `${baseUrl.replace(/\/$/, '')}/api/federation-newsletter/reject?token=${encodeURIComponent(token)}`;
}

export const FEDERATION_NEWSLETTER_TOKEN_KINDS = {
  APPROVE: KIND_APPROVE,
  REJECT: KIND_REJECT,
} as const;
