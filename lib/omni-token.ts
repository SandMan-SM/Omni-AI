export type OmniTokenPayload = {
  sub?: unknown;
  exp?: unknown;
  [key: string]: unknown;
};

const SECONDS_TIMESTAMP_CUTOFF = 10_000_000_000;

export function normalizeTokenExpiry(exp: unknown): number | null {
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return exp < SECONDS_TIMESTAMP_CUTOFF ? exp * 1000 : exp;
}

export function isOmniTokenPayloadFresh(payload: OmniTokenPayload | null | undefined): payload is OmniTokenPayload & { sub: string } {
  if (!payload || typeof payload.sub !== "string") return false;
  const expMs = normalizeTokenExpiry(payload.exp);
  return expMs === null || expMs >= Date.now();
}

export function decodeOmniToken(token: string): OmniTokenPayload | null {
  try {
    const atobFn = globalThis.atob;
    const json =
      typeof atobFn === "function"
        ? atobFn(token)
        : (globalThis as unknown as { Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } } })
            .Buffer?.from(token, "base64")
            .toString("utf8");
    if (!json) return null;
    return JSON.parse(json) as OmniTokenPayload;
  } catch {
    return null;
  }
}
