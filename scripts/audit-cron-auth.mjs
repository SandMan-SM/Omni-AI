#!/usr/bin/env node
/**
 * Gate: an API route may not authenticate a caller with a header the caller
 * sets, and may not treat "no secret configured" as "allow".
 *
 * Why this exists
 *
 * Two live routes accepted a request header as proof of caller identity:
 *
 *   - `lib/cron.ts` accepted `User-Agent: vercel-cron/1.0` (a legacy Vercel
 *     behaviour) INSTEAD OF the shared secret. Five routes sit behind that
 *     gate (`leadership-rotate`, `pantheon-dialogue`, `weakness-scan`,
 *     `morning-digest`, `nightly-intel`) and four of them write to the
 *     database, send email, or return cross-tenant metrics.
 *   - `app/api/federation-newsletter/generate-daily` accepted
 *     `x-vercel-cron: 1` whenever `OMNI_FEDERATION_CRON_SECRET` was unset —
 *     which it is in production, so that bypass was the only path in.
 *
 * Both were verified live before the fix: an unauthenticated request with the
 * header returned 200 and ran the handler.
 *
 * A request header is set by the client. It is not a credential, and it is not
 * harder to set than `Authorization`. `tsc`, `next lint` and `next build` all
 * read the source and none of them can see that a comparison is against
 * something the attacker chooses.
 *
 * The rules
 *
 *   1. `spoofable-cron-header`   — `x-vercel-cron` is read in app/api or lib.
 *   2. `user-agent-as-credential` — an auth module reads `user-agent`.
 *   3. `legacy-cron-user-agent`   — the legacy `vercel-cron/` UA prefix is
 *                                   compared against anywhere in app/api or lib.
 *   4. `unguarded-secret`         — a secret read into a constant is compared
 *                                   without a guard that rejects an empty
 *                                   secret, so an unset env var would make the
 *                                   comparison succeed.
 *   5. `inline-secret-comparison` — the same defect written without a
 *                                   constant: `process.env.SECRET === value`
 *                                   compares undefined to undefined and
 *                                   authorizes everyone.
 *
 * A line may opt out with a trailing `audit:cron-auth-ignore` comment.
 *
 * The scanned surface is every request handler under `app/` (at any depth),
 * every module under `lib/`, and `middleware.ts` — not just `app/api`. A
 * route handler written at `app/foo/route.ts` is just as much a server
 * request handler as one under `app/api/foo/route.ts`, and the gate used to
 * miss every file outside `app/api`.
 *
 * Usage:
 *   node scripts/audit-cron-auth.mjs                    # exit 1 on findings
 *   node scripts/audit-cron-auth.mjs --report            # always exit 0
 *   node scripts/audit-cron-auth.mjs --root <dir>        # scan another repo
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const IGNORE_MARKER = "audit:cron-auth-ignore";

/** Files that hold the shared auth decisions. */
const AUTH_HELPERS = [
  "authorizeCronOrAdmin",
  "assertCronCaller",
  "verifyVoiceToolAuth",
  "verifyElevenLabsSignature",
  "serviceAuthorized",
  "constantTimeEqual",
  "safeSecretEqual",
];

/**
 * Whether a secret is compared against another VALUE — a constant-time
 * comparison, or an equality against an identifier. Comparing against a
 * literal (`SECRET === "prod"`) or reporting a boolean
 * (`(SECRET || "").length >= 16`) is configuration, not authentication, and
 * is deliberately not a finding.
 */
function comparesValue(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`(constantTimeEqual|safeSecretEqual|timingSafeEqual)\\s*\\([^)]*\\b${escaped}\\b[^)]*\\)`).test(text) ||
    new RegExp(`\\b${escaped}\\b\\s*(===|!==|!=)\\s*[A-Za-z_$][\\w$]*`).test(text) ||
    new RegExp(`[A-Za-z_$][\\w$]*\\s*(===|!==|!=)\\s*\\b${escaped}\\b`).test(text)
  );
}

/** A guard that rejects an empty or absent constant. */
function guardedConstant(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`!\\s*\\b${escaped}\\b`).test(text) ||
    new RegExp(`\\b${escaped}\\b\\s*\\.length`).test(text) ||
    new RegExp(`\\b${escaped}\\b\\s*&&`).test(text) ||
    new RegExp(`\\b${escaped}\\b\\s*\\?`).test(text) ||
    new RegExp(`typeof\\s+\\b${escaped}\\b`).test(text)
  );
}

/** A guard that rejects an unset or empty environment variable. */
function guardedEnv(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const read = `process\\.env\\.${escaped}`;
  return (
    new RegExp(`!\\s*${read}\\b`).test(text) ||
    new RegExp(`${read}\\s*&&`).test(text) ||
    new RegExp(`${read}\\s*\\?`).test(text) ||
    new RegExp(`typeof\\s+${read}\\b`).test(text) ||
    // `(process.env.X || "").length >= n` — a length guard on the secret.
    new RegExp(`${read}\\s*\\|\\|[^;\\n]*\\.length`).test(text)
  );
}

const RULES = [
  {
    id: "spoofable-cron-header",
    title: "x-vercel-cron is client-controlled and is not a credential",
    detect(text) {
      // `x-vercel-cron-token` is a different header: it carries the shared
      // secret, so it is a credential rather than a claim about who the
      // caller is. Only the flag-like `x-vercel-cron` is spoofable.
      return /x-vercel-cron(?!-)/i.test(text);
    },
  },
  {
    id: "user-agent-as-credential",
    title: "an auth module must not read the user-agent header",
    detect(text) {
      const isAuthModule = AUTH_HELPERS.some((helper) => text.includes(helper));
      if (!isAuthModule) return false;
      return /headers\.get\(\s*['"`]user-agent['"`]/i.test(text);
    },
  },
  {
    id: "legacy-cron-user-agent",
    title: "the legacy vercel-cron/ user-agent prefix is not a credential",
    detect(text) {
      return /vercel-cron\//i.test(text);
    },
  },
  {
    id: "unguarded-secret",
    title: "a secret comparison must reject an empty secret",
    detect(text) {
      // `const NAME = process.env.X || ''` (or `|| process.env.Y || ''`)
      const declaration = /const\s+([A-Z][A-Z0-9_]{2,})\s*=\s*process\.env\.[A-Z0-9_]+(?:\s*\|\|\s*process\.env\.[A-Z0-9_]+)*\s*\|\|\s*(['"])\2/g;
      const findings = [];
      for (const match of text.matchAll(declaration)) {
        const name = match[1];
        if (!/SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(name)) continue;
        // The secret must actually be compared against another value.
        if (!comparesValue(text, name)) continue;
        // And there must be a guard that rejects an empty/absent secret.
        if (!guardedConstant(text, name)) {
          findings.push({
            line: text.slice(0, match.index).split("\n").length,
            detail: `${name} is compared without a guard that rejects an empty value`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: "conditional-secret-check",
    title: "a secret check that only rejects when the secret is set fails open",
    detect(text) {
      // `if (expectedSecret && provided !== expectedSecret) { return 401 }`
      //
      // The rejection is INSIDE the condition, so when the secret is unset
      // the whole check is skipped and the request is allowed. The correct
      // shape is two separate statements — deny when the secret is missing,
      // then compare — so that an unset secret and a wrong secret both deny.
      const findings = [];
      const pattern = /if\s*\(\s*([A-Za-z_$][\w$]*)\s*&&([^)]*)\)/g;
      for (const match of text.matchAll(pattern)) {
        const name = match[1];
        if (!/secret|token|password|credential/i.test(name)) continue;
        // The condition has to compare that same name against a value.
        const compared = new RegExp(
          `\\b${name}\\b\\s*(?:===|!==|!=)|(?:===|!==|!=)\\s*\\b${name}\\b`,
        ).test(match[2]);
        if (!compared) continue;
        // The name has to be bound to an environment variable.
        if (!new RegExp(`\\b${name}\\b\\s*=\\s*process\\.env\\.`).test(text)) continue;
        // The guarded block has to be the rejection.
        const open = text.indexOf("{", match.index + match[0].length - 1);
        if (open === -1) continue;
        const close = text.indexOf("}", open);
        const body = close === -1 ? text.slice(open, open + 300) : text.slice(open, close);
        if (!/40[13]|unauthoriz|forbidden/i.test(body)) continue;
        findings.push({
          line: text.slice(0, match.index).split("\n").length,
          detail: `${name} gates the rejection — an unset secret skips the check and allows the request`,
        });
      }
      return findings;
    },
  },
  {
    id: "inline-secret-comparison",
    title: "a secret compared inline must reject an empty secret",
    detect(text) {
      // The same defect as `unguarded-secret`, written without a constant:
      //   `constantTimeEqual(provided, process.env.CRON_SECRET)`
      //   `process.env.CRON_SECRET === provided`
      // When the env var is unset, `process.env.CRON_SECRET` is undefined and
      // `constantTimeEqual('', undefined)` is false but `constantTimeEqual('',
      // '')` is TRUE — an empty bearer authorizes the caller. The comparison
      // has to be preceded by a guard that rejects an unset secret.
      const names = new Set();
      for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (/SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(match[1])) names.add(match[1]);
      }
      const findings = [];
      for (const name of names) {
        const read = `process\\.env\\.${name}`;
        // A constant-time comparison that takes the secret as an argument, or
        // an equality comparison against another value (not a literal).
        const call = new RegExp(`(constantTimeEqual|safeSecretEqual|timingSafeEqual)\\s*\\([^)]*${read}[^)]*\\)`);
        const eq = new RegExp(`${read}\\s*(===|!==|!=)\\s*[A-Za-z_$][\\w$]*`);
        const eqReverse = new RegExp(`[A-Za-z_$][\\w$]*\\s*(===|!==|!=)\\s*${read}`);
        const hit = text.match(call) || text.match(eq) || text.match(eqReverse);
        if (!hit) continue;
        if (!guardedEnv(text, name)) {
          findings.push({
            line: text.slice(0, hit.index).split("\n").length,
            detail: `process.env.${name} is compared inline without a guard that rejects an unset value`,
          });
        }
      }
      return findings;
    },
  },
];

/**
 * Strip comments so an explanatory note about a past bypass does not trip
 * the gate. Block comments keep their newlines so line numbers still match
 * the original file.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/** Every source file under the given root. */
function sourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      sourceFiles(path, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry) && !/\.test\.[tj]sx?$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * The server request surface: every route handler anywhere under `app/` (not
 * only `app/api/`), every module under `lib/`, and `middleware.ts`.
 *
 * Both the flat layout (`app/`, `lib/`) and the `src/` layout
 * (`src/app/`, `src/lib/`) are recognised, so the same gate runs against a
 * repo whose sources live under `src/` without a per-repo patch.
 */
function serverFiles(root) {
  const files = [];
  for (const base of [root, join(root, "src")]) {
    for (const file of sourceFiles(join(base, "app"))) {
      if (/(^|\/)route\.(ts|tsx|js|jsx)$/.test(file)) files.push(file);
    }
    files.push(...sourceFiles(join(base, "lib")));
    for (const name of ["middleware.ts", "middleware.tsx", "middleware.js"]) {
      const path = join(base, name);
      if (existsSync(path)) files.push(path);
    }
  }
  return files;
}

function parseArgs(argv) {
  const options = { reportOnly: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--root") options.root = resolve(argv[++i] || "");
  }
  return options;
}

/**
 * Run the gate over one repository.
 *
 * Returns the findings and the number of files checked so other tools
 * (the fleet sweep) can reuse the rules without re-implementing them.
 */
export function runAudit(root) {
  const files = serverFiles(root);
  const findings = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const code = stripComments(text);
    const rel = relative(root, file);
    const lines = text.split("\n");
    for (const rule of RULES) {
      const raw = rule.detect(code);
      if (!raw) continue;
      const hits = Array.isArray(raw) ? raw : [{ line: 0, detail: rule.title }];
      for (const hit of hits) {
        const lineText = hit.line ? lines[hit.line - 1] ?? "" : "";
        if (lineText.includes(IGNORE_MARKER)) continue;
        findings.push({
          rule: rule.id,
          file: rel,
          line: hit.line || null,
          detail: hit.line ? hit.detail : rule.title,
        });
      }
    }
  }
  return { findings, files: files.length };
}

function main() {
  const { reportOnly, root } = parseArgs(process.argv.slice(2));
  const { findings, files } = runAudit(root);

  if (!findings.length) {
    console.log(
      `[cron-auth] ${files} source files checked, no findings — ` +
        `no route authenticates with a client-set header, and no secret comparison is unguarded.`,
    );
    return 0;
  }

  console.error(`[cron-auth] ${findings.length} finding(s) in ${files} source files:`);
  for (const finding of findings) {
    console.error(
      `  ${finding.rule}  ${finding.file}${finding.line ? `:${finding.line}` : ""} — ${finding.detail}`,
    );
  }
  console.error(
    "[cron-auth] a request header is chosen by the caller; it is not a credential. " +
      "Authenticate with a shared secret or a session, and fail closed when the secret is unset.",
  );
  return reportOnly ? 0 : 1;
}

// Only run the gate when invoked directly, so the fleet sweep can import it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
