import {
  createPublicKey,
  type JsonWebKey,
  verify as verifySignature,
} from "node:crypto";

type VercelOidcHeader = {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
};

type VercelOidcClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  iat?: unknown;
  nbf?: unknown;
  exp?: unknown;
  owner?: unknown;
  owner_id?: unknown;
  project?: unknown;
  project_id?: unknown;
  environment?: unknown;
};

type JwkWithId = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type JwksCacheEntry = {
  expiresAt: number;
  keys: JwkWithId[];
};

type TrustedVercelProject = {
  ownerId: string;
  projectId: string;
  projectName: string;
  environment: "production" | "preview" | "development";
};

declare global {
  // eslint-disable-next-line no-var
  var __vercelOidcJwksCache:
    | Map<string, JwksCacheEntry>
    | undefined;
}

const CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_MS = 10 * 60 * 1000;

function decodeJson<T>(segment: string): T | null {
  try {
    return JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
}

function trustedIssuer(value: unknown, owner: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const issuer = new URL(value);
    if (
      issuer.protocol !== "https:" ||
      issuer.hostname !== "oidc.vercel.com" ||
      issuer.search ||
      issuer.hash
    ) {
      return null;
    }

    const path = issuer.pathname.replace(/\/+$/, "");
    if (path !== "" && path !== `/${owner}`) return null;
    return path ? `https://oidc.vercel.com${path}` : "https://oidc.vercel.com";
  } catch {
    return null;
  }
}

function audienceIncludes(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value === expected;
  return Array.isArray(value) && value.includes(expected);
}

async function fetchJwks(
  issuer: string,
  forceRefresh = false,
): Promise<JwkWithId[]> {
  const cache =
    global.__vercelOidcJwksCache ||
    (global.__vercelOidcJwksCache = new Map());
  const cached = cache.get(issuer);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${issuer}/.well-known/jwks`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as {
      keys?: unknown;
    } | null;
    if (!body || !Array.isArray(body.keys)) return [];
    const keys = body.keys.filter(
      (key): key is JwkWithId =>
        Boolean(key) && typeof key === "object" && !Array.isArray(key),
    );
    cache.set(issuer, {
      keys,
      expiresAt: Date.now() + JWKS_CACHE_MS,
    });
    return keys;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function findSigningKey(
  issuer: string,
  kid: string,
): Promise<JwkWithId | null> {
  const cachedKeys = await fetchJwks(issuer);
  const cached = cachedKeys.find((key) => key.kid === kid);
  if (cached) return cached;

  const refreshedKeys = await fetchJwks(issuer, true);
  return refreshedKeys.find((key) => key.kid === kid) || null;
}

export async function verifyVercelProjectToken(
  token: string,
  trusted: TrustedVercelProject,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedClaims, encodedSignature] = parts;

  const header = decodeJson<VercelOidcHeader>(encodedHeader);
  const claims = decodeJson<VercelOidcClaims>(encodedClaims);
  if (!header || !claims) return false;
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    typeof claims.owner !== "string"
  ) {
    return false;
  }

  const issuer = trustedIssuer(claims.iss, claims.owner);
  if (!issuer) return false;

  const expectedAudience = `https://vercel.com/${claims.owner}`;
  const expectedSubject =
    `owner:${claims.owner}:project:${trusted.projectName}:` +
    `environment:${trusted.environment}`;
  if (
    !audienceIncludes(claims.aud, expectedAudience) ||
    claims.sub !== expectedSubject ||
    claims.owner_id !== trusted.ownerId ||
    claims.project_id !== trusted.projectId ||
    claims.project !== trusted.projectName ||
    claims.environment !== trusted.environment
  ) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    claims.iat > now + CLOCK_SKEW_SECONDS ||
    claims.exp < now - CLOCK_SKEW_SECONDS ||
    (typeof claims.nbf === "number" &&
      claims.nbf > now + CLOCK_SKEW_SECONDS)
  ) {
    return false;
  }

  const jwk = await findSigningKey(issuer, header.kid);
  if (!jwk) return false;

  try {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    return verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    return false;
  }
}
