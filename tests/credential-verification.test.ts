import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { verifyOmniToken } from "../lib/server/omni-session-token.ts";
import { signOmniTokenWithSecret } from "../supabase/functions/auth-login/session-token.ts";
import { scanTree } from "../scripts/audit-credential-verification.mjs";

/**
 * The bearer contract: MINT SIGNED, VERIFY SIGNED.
 *
 * The defect this pins is the one the fleet sweep found by accident on
 * 2026-11-07 — every copy of this repo that predates 2026-10-28 decoded the
 * `omni_token` as plain base64 JSON, so `{"is_admin":true}` was a valid
 * admin credential. The canonical repo had fixed the server side; the MINT
 * side had not, because the mint lives in a Deno edge function that no gate
 * was reading.
 *
 * These tests pin three things:
 *
 *   1. The edge function's signer produces a token the canonical server
 *      verifier ACCEPTS — the two runtimes must agree on the format, and
 *      "they look the same" is not evidence.
 *   2. A forged, unsigned token is REJECTED — the whole point of signing.
 *   3. The gate fires on both shapes and stays quiet on the fixed ones. A
 *      rule that has never fired has never been tested.
 */

const SECRET = "test-secret-value-that-is-long-enough-to-be-used-0123456789";

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "cred-verification-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("the edge function's signer produces a token the server verifier accepts", async () => {
  const payload = {
    sub: "profile-123",
    username: "operator",
    is_admin: true,
    exp: Date.now() + 60_000,
  };
  const token = await signOmniTokenWithSecret(payload, SECRET);

  // The server verifies with the SAME secret source.
  const previous = process.env.OMNI_AUTH_TOKEN_SECRET;
  process.env.OMNI_AUTH_TOKEN_SECRET = SECRET;
  try {
    const verified = verifyOmniToken(token);
    assert.ok(verified, "the server verifier must accept the edge function's token");
    assert.equal(verified.sub, "profile-123");
    assert.equal(verified.is_admin, true);
  } finally {
    if (previous === undefined) delete process.env.OMNI_AUTH_TOKEN_SECRET;
    else process.env.OMNI_AUTH_TOKEN_SECRET = previous;
  }
});

test("an unsigned, forged token is rejected", async () => {
  const previous = process.env.OMNI_AUTH_TOKEN_SECRET;
  process.env.OMNI_AUTH_TOKEN_SECRET = SECRET;
  try {
    const forged = Buffer.from(
      JSON.stringify({ sub: "x", is_admin: true, exp: Date.now() + 60_000 }),
    ).toString("base64");
    assert.equal(
      verifyOmniToken(forged),
      null,
      "a base64 payload must never be admitted as a credential",
    );
  } finally {
    if (previous === undefined) delete process.env.OMNI_AUTH_TOKEN_SECRET;
    else process.env.OMNI_AUTH_TOKEN_SECRET = previous;
  }
});

test("the gate fires on a verifier that decodes a bearer and never verifies it", () => {
  const root = tree({
    "lib/auth.ts": `
export async function requireAdmin(req: Request) {
  const secret = process.env.ADMIN_API_KEY;
  if (!secret) throw new Error("Unauthorized");
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
  const json = Buffer.from(bearer, "base64").toString("utf8");
  const payload = JSON.parse(json);
  return payload.is_admin === true;
}
`,
  });
  try {
    const { findings } = scanTree(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, "bearer-decoded-without-verification");
    assert.match(findings[0].file, /lib\/auth\.ts$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the gate fires on a session token minted without a signature", () => {
  const root = tree({
    "lib/login.ts": `
export async function issueToken(payload: Record<string, unknown>) {
  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  return { access_token: token };
}
`,
  });
  try {
    const { findings } = scanTree(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, "session-token-minted-without-signature");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the gate is quiet on a tree that verifies and signs", () => {
  const root = tree({
    "lib/auth.ts": `
import { verifyOmniToken } from "./session-token";

export async function requireAdmin(req: Request) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
  const payload = verifyOmniToken(bearer);
  return payload?.is_admin === true;
}
`,
    "lib/session-token.ts": `
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyOmniToken(token: string) {
  const expected = createHmac("sha256", "secret").update(token).digest();
  return timingSafeEqual(expected, Buffer.from(token)) ? { is_admin: false } : null;
}
`,
    "lib/login.ts": `
import { signOmniToken } from "./session-token";

export async function issueToken(payload: Record<string, unknown>) {
  const token = await signOmniToken(payload);
  return { access_token: token };
}
`,
  });
  try {
    const { findings } = scanTree(root);
    assert.equal(findings.length, 0, JSON.stringify(findings, null, 2));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the canonical tree passes the gate", () => {
  const { findings } = scanTree(process.cwd());
  assert.equal(
    findings.length,
    0,
    `the canonical tree must be clean:\n${JSON.stringify(findings, null, 2)}`,
  );
});
