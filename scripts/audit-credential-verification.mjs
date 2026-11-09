#!/usr/bin/env node
/**
 * Gate: a bearer token must be VERIFIED, not merely DECODED.
 *
 * Why this exists
 *
 * On 2026-11-07 the fleet sweep found, "by accident", that every copy of this
 * repo that predates 2026-10-28 decoded the `omni_token` bearer as plain
 * base64 JSON. `requireAdmin()` reads `is_admin` out of the decoded payload,
 * so anyone who wrote `{"is_admin":true}` was admitted as an admin. The
 * canonical repo had already fixed it — the token is signed
 * (`omni1.<payload>.<HMAC-SHA256>`) and the server verifies the signature
 * before it trusts a single claim — but **no gate could tell the difference**:
 * `tsc`, `next build`, the RLS gate, the cron-auth gate and the
 * internal-surface gate all read the source, and all of them see a
 * well-formed decoder where the defect is.
 *
 * The class was found by a sweep that was looking for something else. That is
 * the definition of a defect class that has no instrument: it is reported
 * when somebody happens to be looking. The instrument belongs here.
 *
 * THE RULES
 *
 *   1. `bearer-decoded-without-verification` — a credential verifier (the
 *      DERIVED set, the same one the public-PII gate derives from `lib/`)
 *      reaches a base64/atob decode of a bearer and never reaches a
 *      signature verification. A decoder is not a credential check.
 *   2. `session-token-minted-without-signature` — a session token is issued
 *      by base64-encoding a JSON payload, with no signature over it. A token
 *      that is minted unsigned is a token anybody can mint.
 *
 * The two halves are the same contract seen from each end: **mint signed,
 * verify signed.** Fixing only one end leaves a bearer that is either
 * forgeable or unverifiable — and the two ends are in different runtimes
 * (the Next.js server and the Supabase edge function), which is exactly why
 * the mint side survived the fix that closed the verify side.
 *
 * WHY THE POPULATION IS DERIVED
 *
 * "Which functions decide whether a caller is authenticated?" had two
 * hand-typed answers in this repo, and the one with the shorter list
 * reported three authenticated routes as anonymous (session 65). The derived
 * set lives in `scripts/audit-public-pii.mjs` and is IMPORTED here, so the
 * two gates cannot disagree about what a credential verifier is.
 *
 * Usage:
 *   node scripts/audit-credential-verification.mjs             # exit 1 on findings
 *   node scripts/audit-credential-verification.mjs --report    # always exit 0
 *   node scripts/audit-credential-verification.mjs --root <dir># scan another tree
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  console.error(
    "[credential-verification] the TypeScript compiler is not available — the credential " +
      "verifiers cannot be derived, so no route can be judged. The result is UNKNOWN. " +
      "This gate did not run.\n           Install the dependencies:  npm install",
  );
  process.exit(2);
}

const { deriveCredentialVerifiers, extractFunctions } = await import("./audit-public-pii.mjs");

export const RULES = [
  {
    id: "bearer-decoded-without-verification",
    title: "a credential verifier decodes a bearer and never verifies its signature",
  },
  {
    id: "session-token-minted-without-signature",
    title: "a session token is issued by base64-encoding a payload with no signature over it",
  },
];

/**
 * A base64/atob decode of something that could be a bearer.
 *
 * Deliberately narrow: `Buffer.from(x, 'base64')` on a MAC (the newsletter
 * and unsubscribe tokens) is a DECODE of a signed value, and the verifier
 * that owns it compares in constant time. What is being caught here is a
 * decode whose RESULT is trusted as an identity.
 */
const DECODE_SIGNAL = [
  /\bdecodeOmniToken\s*\(/,
  /\bBuffer\.from\s*\(\s*[^;()]{0,120}?,\s*['"]base64['"]/,
  /\batob\s*\(/,
  /\bbtoa\s*\(\s*JSON\.stringify\(/,
];

/**
 * A signature verification.
 *
 * `createHmac` is deliberately NOT here: signing is a mint-side operation.
 * A verifier that decodes a bearer and also SIGNS something has not checked
 * the bearer it was given.
 */
const VERIFY_SIGNAL = [
  /\bverifyOmniToken\s*\(/,
  /\btimingSafeEqual\s*\(/,
  /\bcrypto\.subtle\.verify\b/,
  /\bcreateVerify\s*\(/,
  /\bverifyJwt\b/,
  /\bjwt\.verify\b/,
  /\bjose\.jwtVerify\b/,
  /\bverifySignature\s*\(/,
  /\bcheckSignature\s*\(/,
  /\bverifyHmac\b/,
];

/**
 * A mint: a JSON payload encoded as base64 and handed out as a token.
 *
 * Both runtimes are covered — `Buffer.from(...).toString('base64')` in
 * Node/Next, `btoa(JSON.stringify(...))` in the Deno edge function. The
 * second one is why the edge function is in scope: it is where the fleet
 * copies actually MINT their admin token, so a gate that only read `lib/`
 * and `app/` would have called a tree with a live unsigned mint clean.
 *
 * Two shapes, because the two runtimes write it differently: the encoded
 * payload assigned TO a token-shaped name, and a token-shaped name assigned
 * the encoded payload.
 */
const MINT_SIGNAL = [
  new RegExp(
    [
      "(?:access_token|omni_token|session_?token|auth_?token|bearer)",
      "\\s*[:=]\\s*[\\s\\S]{0,200}?",
      "(?:Buffer\\.from\\(\\s*JSON\\.stringify\\([^)]*\\)\\s*\\)\\s*\\.toString\\(\\s*['\"]base64['\"]\\s*\\)",
      "|btoa\\(\\s*JSON\\.stringify\\([^)]*\\)\\s*\\)",
      ")",
    ].join(""),
    "i",
  ),
  new RegExp(
    [
      "\\b(?:const|let|var)\\s+(?:access_token|omni_token|session_?token|auth_?token|bearer|token)\\s*=\\s*",
      "(?:Buffer\\.from\\(\\s*JSON\\.stringify\\([^)]*\\)\\s*\\)\\s*\\.toString\\(\\s*['\"]base64['\"]\\s*\\)",
      "|btoa\\(\\s*JSON\\.stringify\\([^)]*\\)\\s*\\))",
    ].join(""),
    "i",
  ),
];

const SIGN_CALL =
  /\bsignOmniToken\s*\(|\bcreateHmac\s*\(|\bjwt\.sign\s*\(|\bjose\.SignJWT\b|\bcrypto\.subtle\.sign\b/;

function walkSource(dir, depth = 0) {
  if (depth > 8) return [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkSource(path, depth + 1));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

const has = (text, signals) => signals.some((re) => re.test(text));

/** The names a function body calls, as bare identifiers before a `(`. */
export function callsOf(body) {
  const names = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = re.exec(body))) names.add(match[1]);
  return [...names];
}

/**
 * The transitive closure of a function over the functions it calls.
 *
 * Scope-aware: a call is only followed when the CALLED NAME is a function
 * this tree actually declares. A name collision with an unrelated function
 * in another file is a false negative at worst, and the closure is bounded
 * by the tree's own declarations.
 */
export function closureOf(fn, byName) {
  const seen = new Set();
  const queue = [fn];
  const members = [];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    members.push(current);
    for (const call of current.calls ?? []) {
      for (const candidate of byName.get(call) ?? []) {
        if (!seen.has(candidate)) queue.push(candidate);
      }
    }
  }
  return members;
}

/**
 * Scan one tree.
 *
 * Returns the population it examined alongside the findings, so "found
 * nothing" and "looked at nothing" can never print the same line.
 */
export function scanTree(root) {
  const functions = [];
  const byName = new Map();
  for (const file of walkSource(join(root, "lib"))) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const fn of extractFunctions(text, file)) {
      const entry = { ...fn, file, text, calls: callsOf(fn.body) };
      functions.push(entry);
      if (!byName.has(entry.name)) byName.set(entry.name, []);
      byName.get(entry.name).push(entry);
    }
  }

  // The credential verifiers — DERIVED, from the same source the public-PII
  // gate uses, so the two gates cannot disagree about what a verifier is.
  const verifierNames = deriveCredentialVerifiers(root);
  const findings = [];
  const seen = new Set();

  for (const name of verifierNames) {
    for (const verifier of byName.get(name) ?? []) {
      const members = closureOf(verifier, byName);
      const text = members.map((m) => m.body).join("\n");
      if (!has(text, DECODE_SIGNAL)) continue;
      if (has(text, VERIFY_SIGNAL)) continue;
      const key = `${verifier.file}::${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const decodeSite = members.find((m) => has(m.body, DECODE_SIGNAL));
      findings.push({
        rule: "bearer-decoded-without-verification",
        file: verifier.file.replace(`${root}/`, ""),
        verifier: name,
        detail:
          `the verifier \`${name}\` reaches a base64 decode of a bearer and never verifies a ` +
          `signature, so the token's claims are trusted on sight`,
        where: decodeSite ? decodeSite.file.replace(`${root}/`, "") : null,
      });
    }
  }

  // The mint side: a session token issued with no signature over it.
  // `lib/` and `app/` are the Next.js runtime; `supabase/functions` is the
  // Deno edge runtime that mints the login token in the fleet copies.
  for (const scanRoot of ["lib", "app", "supabase/functions"]) {
    for (const file of walkSource(join(root, scanRoot))) {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (!has(text, MINT_SIGNAL)) continue;
      if (SIGN_CALL.test(text)) continue;
      findings.push({
        rule: "session-token-minted-without-signature",
        file: file.replace(`${root}/`, ""),
        verifier: null,
        detail:
          "a session token is issued by base64-encoding a JSON payload with no signature " +
          "over it, so anybody can mint one",
        where: null,
      });
    }
  }

  return { findings, verifierNames: [...verifierNames], functionCount: functions.length };
}

function main() {
  const rootIndex = process.argv.indexOf("--root");
  const ROOT = rootIndex !== -1 ? process.argv[rootIndex + 1] : process.cwd();
  const REPORT_ONLY = process.argv.includes("--report");

  if (!existsSync(join(ROOT, "lib"))) {
    console.error(
      `[credential-verification] ${ROOT} has no lib/ directory — there is nothing to judge. ` +
        "The result is UNKNOWN. This gate did not run.",
    );
    process.exit(2);
  }

  const { findings, verifierNames, functionCount } = scanTree(ROOT);

  if (findings.length === 0) {
    console.log(
      `[credential-verification] ${verifierNames.length} credential verifier(s) derived from lib/ ` +
        `over ${functionCount} function(s) — 0 findings across ${RULES.length} rules. ` +
        "Every bearer is verified before its claims are trusted.",
    );
    process.exit(0);
  }

  console.log(
    `\n[credential-verification] ${findings.length} finding(s) across ${RULES.length} rule(s):`,
  );
  for (const finding of findings) {
    console.log(`  [${finding.rule}] ${finding.file}`);
    console.log(`      ${finding.detail}`);
    if (finding.where && finding.where !== finding.file) {
      console.log(`      the decode lives in ${finding.where}`);
    }
  }
  console.log(
    "\n[credential-verification] A bearer that is decoded is not a credential. Verify the " +
      "signature (HMAC over the payload) before trusting any claim it carries.",
  );
  process.exit(REPORT_ONLY ? 0 : 1);
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) main();
