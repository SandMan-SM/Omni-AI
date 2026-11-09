/**
 * Session-token signing for the `auth-login` edge function.
 *
 * WHY THIS FILE EXISTS
 *
 * The token this function hands out carries `is_admin`. A bearer that is only
 * BASE64-ENCODED is not a credential: anybody can write
 * `btoa(JSON.stringify({ sub: "x", is_admin: true }))` and be admitted as an
 * admin by any server that merely decodes it. The server-side verifier
 * (`lib/server/omni-session-token.ts`) signs with HMAC-SHA256 and refuses an
 * unsigned token, so the mint has to match it exactly:
 *
 *   key     = HMAC-SHA256(secret, "omni-ai/session-signing/v1")
 *   token   = "omni1." + base64url(JSON payload) + "." + base64url(HMAC(key, message))
 *
 * The key is derived from OMNI_AUTH_TOKEN_SECRET, or from the deployment's
 * service-role key — the same two sources the server uses, and never a public
 * anon key. If neither is present the function refuses to issue a session
 * rather than issuing one nobody can use.
 *
 * WHY IT IS A SEPARATE FILE
 *
 * The signing scheme has to be PROVABLE, and the proof lives in
 * `tests/credential-verification.test.ts`, which signs a payload with this
 * code and asserts that the canonical server verifier accepts the result.
 * A file the edge function bundles but a test cannot import is a file nobody
 * can check — and the first version of this defect was exactly that: the
 * mint lived inside a 200-line edge function that no gate could read.
 *
 * `npm run audit:credential-verification` reads this file too: an unsigned
 * mint anywhere in the tree — this runtime or the Next.js one — is a
 * finding.
 */

// Deno's global is declared rather than imported, so the same file is
// readable by the Node test that proves the scheme (and by `tsc`).
declare const Deno: { env: { get(key: string): string | undefined } };

const encoder = new TextEncoder();

export function base64Url(bytes: Uint8Array): string {
  // Indexed, not `for...of`: this file is pulled into the Node build by the
  // proof test, and the repo's TypeScript target predates downlevel iteration.
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signingKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const derived = await crypto.subtle.sign(
    "HMAC",
    raw,
    encoder.encode("omni-ai/session-signing/v1"),
  );
  return crypto.subtle.importKey(
    "raw",
    derived,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Sign a session payload with an explicit secret.
 *
 * The secret is a PARAMETER so this function is pure: the edge function reads
 * the environment, the test passes a fixture, and neither can drift into the
 * other.
 */
export async function signOmniTokenWithSecret(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error("Omni session signing key is not configured");
  }
  const key = await signingKey(secret);
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const message = `omni1.${encoded}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
  );
  return `${message}.${base64Url(signature)}`;
}

/** Sign with the deployment's configured key. */
export async function signOmniToken(payload: Record<string, unknown>): Promise<string> {
  const secret =
    Deno.env.get("OMNI_AUTH_TOKEN_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return signOmniTokenWithSecret(payload, secret ?? "");
}

/**
 * THE SECRET MUST BE THE SAME ON BOTH SIDES OF THE CONTRACT
 *
 * This function signs in the Supabase edge runtime; the server verifies
 * in the Next.js runtime. Both derive their key from
 * `OMNI_AUTH_TOKEN_SECRET ?? SUPABASE_SERVICE_ROLE_KEY`, so the two sides
 * agree ONLY if they read the same value of that expression.
 *
 * Measured on 2026-11-09: the Supabase project carries TWO service-role
 * secrets with DIFFERENT digests (`SUPABASE_SERVICE_ROLE_KEY` and
 * `supabase_service_role_key`), and the flagship's Vercel project holds a
 * THIRD candidate — its production value is marked sensitive and comes
 * back blank from `vercel env pull`, so the equality cannot be asserted
 * from the code that needs it. `OMNI_AUTH_TOKEN_SECRET` is set on NEITHER
 * side, so both currently fall through to a service-role key whose
 * equality is assumed, not known.
 *
 * That is why this file's signing path must not be deployed on its own:
 * a token signed here and verified there is only accepted when the two
 * sides derive the same key. Set `OMNI_AUTH_TOKEN_SECRET` to one explicit
 * value on the edge AND on every project that consumes the token, and the
 * assumption becomes a fact.
 */
