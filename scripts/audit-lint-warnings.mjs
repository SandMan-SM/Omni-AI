#!/usr/bin/env node
/**
 * audit:lint — the build must not carry a lint WARNING.
 *
 * WHY THIS GATE EXISTS
 *
 * CLAUDE.md says it in one line: "Fix every error and every warning the
 * build reports. A build that is not green is not done." That sentence was
 * prose, and prose did not hold: `next build` printed
 *
 *   ./components/LegacyTree.tsx
 *   46:7  Warning: Using `<img>` could result in slower LCP and higher
 *        bandwidth. Consider using `<Image />` from `next/image` …
 *
 * on every deployment for four days (introduced 2026-11-13 in `8374d81c`,
 * still present at `acd60578`). Next.js reports warnings but does not fail
 * the build on them, so the build stayed green while the warning printed on
 * every deploy and was read by nobody. The warning was real: the component
 * was the only one in the tree serving a 403 KB asset through a raw `<img>`
 * — no responsive `srcset`, no optimization.
 *
 * This is the same shape as every other gate in this repo: a rule written
 * in prose does not hold, and the only thing that holds is a gate. The
 * existing gates cover contracts between artifacts (sitemap vs routes,
 * declared size vs artwork, publish state vs column defaults). This one
 * covers the last unenforced contract in the toolchain — the lint result
 * vs the build's exit code.
 *
 * RULES
 *
 *   1. lint-warning
 *      Any ESLint warning (severity 1) anywhere in the linted tree. An
 *      error (severity 2) is also a finding — `next build` already fails on
 *      it, but this gate must fail closed even if the build chain is
 *      invoked without the lint step.
 *
 *   2. lint-unused-disable-directive
 *      A disable comment that no longer suppresses anything. It is the
 *      residue of a rule that was fixed or removed, and it is reported so
 *      the suppression stays honest.
 *
 * SCOPE
 *
 *   The same directories `next lint` covers — src, app, pages, components,
 *   lib — so the gate and the build's own lint pass measure the same
 *   population. The config is the repo's own `.eslintrc.json`, resolved
 *   through the same `eslint-config-next` the build uses, so the gate
 *   cannot disagree with the build about what the rules are.
 *
 * FAILS CLOSED
 *
 *   If ESLint cannot be loaded, or the config cannot be resolved, the
 *   result is UNKNOWN and the gate exits 2 — never 0. A gate that cannot
 *   measure must not print "no findings".
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
// The directories `next lint` walks by default.
const SCAN_DIRS = ["src", "app", "pages", "components", "lib"];
const EXTENSIONS = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx"];

/**
 * Lint a set of directories and report what was examined and what fired.
 *
 * Throws when the tree cannot be measured — the caller decides whether that
 * is a failure (the CLI exits 2) or a test assertion.
 */
export async function lintTree({ root = ROOT, dirs = SCAN_DIRS } = {}) {
  let ESLint;
  try {
    ({ ESLint } = await import("eslint"));
  } catch (error) {
    throw new Error(`eslint could not be loaded (is node_modules installed?): ${error.message}`);
  }

  if (!existsSync(path.join(root, ".eslintrc.json"))) {
    throw new Error(".eslintrc.json is missing — there is no rule set to run.");
  }

  const present = dirs.filter((d) => existsSync(path.join(root, d)));
  if (present.length === 0) {
    throw new Error(`none of ${dirs.join(", ")} exist — there is no tree to lint.`);
  }

  const eslint = new ESLint({
    cwd: root,
    useEslintrc: true,
    resolvePluginsRelativeTo: root,
    extensions: EXTENSIONS,
    reportUnusedDisableDirectives: "warn",
  });

  const results = await eslint.lintFiles(present);

  const findings = [];
  const firedRules = new Set();

  for (const result of results) {
    const file = path.relative(root, result.filePath);
    for (const message of result.messages) {
      if (message.severity !== 1 && message.severity !== 2) continue;
      const ruleId = message.ruleId || "eslint(parse)";
      firedRules.add(ruleId);
      findings.push({
        file,
        line: message.line ?? 0,
        column: message.column ?? 0,
        severity: message.severity,
        rule: message.message.includes("Unused eslint-disable directive")
          ? "lint-unused-disable-directive"
          : "lint-warning",
        detail: message.message,
      });
    }
  }

  // How many rules the resolved configuration actually enables — the number
  // the gate RAN, not the number that fired.
  let enabledRules = 0;
  for (const dir of present) {
    try {
      const config = await eslint.calculateConfigForFile(path.join(root, dir, "index.tsx"));
      if (config && config.rules) {
        enabledRules = Math.max(enabledRules, Object.keys(config.rules).length);
      }
    } catch {
      // A directory with no representative file — the file count below is the
      // authoritative population.
    }
  }

  return { files: results.length, dirs: present, enabledRules, firedRules, findings };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  let report;
  try {
    report = await lintTree();
  } catch (error) {
    console.error(`[lint] ${error.message}`);
    console.error("[lint] the result is UNKNOWN — this gate cannot measure, so it does not pass.");
    process.exit(2);
  }

  for (const f of report.findings) {
    const label = f.severity === 2 ? "error" : "warning";
    console.error(`[lint] ${f.file}:${f.line}:${f.column} — ${f.rule} (${label})`);
    console.error(`    ${f.detail}`);
  }

  console.log(
    `[lint] examined ${report.files} file(s) in ${report.dirs.length} director${report.dirs.length === 1 ? "y" : "ies"} ` +
      `with ${report.enabledRules} rule(s) enabled; ${report.firedRules.size} rule(s) fired; ` +
      `${report.findings.length} finding(s) across 2 rules.`,
  );

  if (report.findings.length > 0) {
    console.error("[lint] FAILED — the build would carry a lint warning.");
    process.exit(1);
  }
  console.log("[lint] no findings — the tree lints clean, with no warnings to ignore.");
}
