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
 *
 * A line may opt out with a trailing `audit:cron-auth-ignore` comment.
 *
 * Usage:
 *   node scripts/audit-cron-auth.mjs           # exit 1 on findings
 *   node scripts/audit-cron-auth.mjs --report   # always exit 0
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
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

const RULES = [
  {
    id: "spoofable-cron-header",
    title: "x-vercel-cron is client-controlled and is not a credential",
    detect(text) {
      return /x-vercel-cron/i.test(text);
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
        // The secret must actually be compared somewhere in the file, with the
        // secret on either side of the comparison.
        const compared =
          new RegExp(`\\b${name}\\b[^;\\n]*(===|!==|!=|constantTimeEqual|safeSecretEqual|timingSafeEqual)`).test(text)
          || new RegExp(`(===|!==|!=|constantTimeEqual|safeSecretEqual|timingSafeEqual)[^;\\n]*\\b${name}\\b`).test(text);
        if (!compared) continue;
        // And there must be a guard that rejects an empty/absent secret.
        const guarded = new RegExp(
          `(!${name}\\b|${name}\\.length|!${name}\\s*\\)|\\b${name}\\s*&&)`,
        ).test(text);
        if (!guarded) {
          findings.push({
            line: text.slice(0, match.index).split("\n").length,
            detail: `${name} is compared without a guard that rejects an empty value`,
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

/** Every .ts/.tsx file under the given roots. */
function sourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      sourceFiles(path, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.[tj]sx?$/.test(entry)) out.push(path);
  }
  return out;
}

function main() {
  const reportOnly = process.argv.includes("--report");
  const files = [
    ...sourceFiles(join(ROOT, "app", "api")),
    ...sourceFiles(join(ROOT, "lib")),
  ];

  const findings = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const code = stripComments(text);
    const rel = relative(ROOT, file);
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

  if (!findings.length) {
    console.log(
      `[cron-auth] ${files.length} source files checked, no findings — ` +
        `no route authenticates with a client-set header, and no secret comparison is unguarded.`,
    );
    return 0;
  }

  console.error(`[cron-auth] ${findings.length} finding(s) in ${files.length} source files:`);
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

process.exit(main());
