export type OmniTokenPayload = {
  sub?: unknown;
  exp?: unknown;
  [key: string]: unknown;
};

const SECONDS_TIMESTAMP_CUTOFF = 10_000_000_000;
export const OMNI_TOKEN_VERSION = "omni1";
export const OMNI_TOKEN_PATTERN = /^omni1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;

export function normalizeTokenExpiry(exp: unknown): number | null {
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return exp < SECONDS_TIMESTAMP_CUTOFF ? exp * 1000 : exp;
}

export function isOmniTokenPayloadFresh(payload: OmniTokenPayload | null | undefined): payload is OmniTokenPayload & { sub: string } {
  if (!payload || typeof payload.sub !== "string" || !payload.sub.trim()) return false;
  const expMs = normalizeTokenExpiry(payload.exp);
  return expMs !== null && expMs > Date.now();
}

/** Decode for browser display only. Server authorization MUST use verifyOmniToken. */
export function decodeOmniToken(token: string): OmniTokenPayload | null {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const match = OMNI_TOKEN_PATTERN.exec(token);
    if (!match) return null; // Unsigned legacy sessions must sign in again.
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = globalThis.atob(base64);
    const json = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as OmniTokenPayload
      : null;
  } catch {
    return null;
  }
}
