/**
 * Vercel API access for the operator scripts.
 *
 * Why this exists
 *
 * The Vercel CLI keeps an OAuth access token in its auth file, and that token
 * **expires**. The CLI refreshes it on demand; a script that reads the file
 * directly does not. `audit-deploy-source-of-truth.mjs` did exactly that, and
 * when the token had expired the API answered `403 invalidToken` — which the
 * script flattened into `null`, which the caller flattened into "the Vercel
 * API returned no production deployments". That is the most dangerous possible
 * message from this gate: it says *nothing is running* when the truth is
 * *I could not look*. The gate exists to stop a stale deploy, so it must fail
 * closed on a credential problem, never shrug.
 *
 * What it does
 *
 * - `VERCEL_TOKEN` wins, so the scripts still run in CI.
 * - Otherwise it reads the CLI's auth file, and **refreshes the access token
 *   through the same OAuth flow the CLI uses** when the stored one has
 *   expired, writing the new token back so the CLI and the scripts agree.
 * - `vercelFetch` returns the HTTP **status** alongside the body. A caller
 *   that cannot distinguish "403" from "empty list" will eventually confuse
 *   them, and this is the layer where that distinction is still available.
 *
 * The token value is never printed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The Vercel CLI's public OAuth client id (a constant in the CLI itself). */
const CLI_CLIENT_ID = "cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp";
const ISSUER = "https://vercel.com";
const AUTH_PATH = join(
  homedir(),
  "Library/Application Support/com.vercel.cli/auth.json",
);

/** The CLI's stored credentials, or null. */
function readAuth() {
  if (!existsSync(AUTH_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(AUTH_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Write the CLI's credentials back, preserving every other field. */
function writeAuth(auth) {
  writeFileSync(AUTH_PATH, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
}

/** The OAuth token endpoint, discovered the way the CLI discovers it. */
async function tokenEndpoint() {
  const response = await fetch(
    `${ISSUER}/.well-known/openid-configuration`,
    { headers: { "Content-Type": "application/json" } },
  );
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  return typeof json?.token_endpoint === "string" ? json.token_endpoint : null;
}

/**
 * Exchange the stored refresh token for a new access token.
 *
 * Returns the new token and its expiry, or null when the refresh is not
 * possible — no refresh token, no discovery endpoint, or the refresh itself
 * was rejected.
 */
async function refreshAccessToken(auth) {
  if (!auth || typeof auth.refreshToken !== "string" || !auth.refreshToken) {
    return null;
  }
  const endpoint = await tokenEndpoint();
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
    }),
  });
  if (!response.ok) return null;

  const json = await response.json().catch(() => null);
  if (!json || typeof json.access_token !== "string") return null;

  const next = {
    ...auth,
    token: json.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(json.expires_in || 0),
  };
  if (typeof json.refresh_token === "string") next.refreshToken = json.refresh_token;
  try {
    writeAuth(next);
  } catch {
    // A read-only auth file is not fatal — the token still works this run.
  }
  return { token: next.token, expiresAt: next.expiresAt };
}

/**
 * A usable Vercel access token.
 *
 * `VERCEL_TOKEN` wins so the scripts work in CI. Otherwise the CLI's auth
 * file is read, and the token is refreshed when it has expired.
 */
export async function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;

  const auth = readAuth();
  if (!auth || typeof auth.token !== "string") {
    throw new Error(
      "no Vercel token: authenticate the CLI (`npx vercel whoami`) or set VERCEL_TOKEN",
    );
  }

  const expiresAt = Number(auth.expiresAt || 0);
  if (expiresAt && expiresAt * 1000 > Date.now() + 60_000) {
    return auth.token;
  }

  const refreshed = await refreshAccessToken(auth);
  if (refreshed) return refreshed.token;

  // Not expired according to the file, or the refresh failed — try the token
  // we have and let the caller's status handling decide.
  return auth.token;
}

/**
 * A Vercel API call that reports its status.
 *
 * Returns `{ status, body }`. `body` is null when the response was not JSON.
 * The status is always present, so a caller can tell an empty list from a
 * rejected credential.
 */
export async function vercelFetch(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

/**
 * A Vercel API call that refreshes the credential once and then fails closed.
 *
 * Throws an Error whose message names the credential problem when the API
 * cannot be reached with a valid token. It never returns null for "could not
 * authenticate" — that ambiguity is the bug this module exists to remove.
 */
export async function vercelJson(url, { allowRefresh = true } = {}) {
  let token = await vercelToken();
  let response = await vercelFetch(url, token);

  // A token supplied through the environment is the caller's credential (CI,
  // or an explicit override). It is never silently replaced by the CLI's local
  // auth file — a rejected `VERCEL_TOKEN` must say so, not quietly borrow a
  // different identity.
  const canRefresh = allowRefresh && !process.env.VERCEL_TOKEN;

  if (!response.ok && (response.status === 401 || response.status === 403) && canRefresh) {
    const auth = readAuth();
    const refreshed = await refreshAccessToken(auth);
    if (refreshed) {
      token = refreshed.token;
      response = await vercelFetch(url, token);
    }
  }

  if (!response.ok) {
    const detail = response.body?.error?.message || response.body?.message || "";
    throw new Error(
      `Vercel API ${response.status}${detail ? ` — ${detail}` : ""}. ` +
        "The credential could not be used, so the result is unknown — this is not a clean result.",
    );
  }
  return response.body;
}
