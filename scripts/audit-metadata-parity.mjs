#!/usr/bin/env node
/**
 * Gate: a metadata override must not silently drop a handle the site's
 * own metadata factory declares.
 *
 * Why this exists
 *
 * `buildMetadata()` in `lib/seo.ts` is the site's single metadata
 * factory. It emits a Twitter block with BOTH `site` and `creator`.
 * Next.js does not MERGE a metadata block — a page that declares its
 * own `twitter:` REPLACES the factory's, field for field. So a page
 * that overrides `twitter` to set a dynamic title and forgets one
 * handle loses it, and nothing complains: `tsc` is happy, `next
 * build` is happy, and the page still renders a valid Twitter card.
 *
 * The rule already existed in this repo's brief — "twitter-handle-
 * parity: any page that overrides the `twitter` block must re-declare
 * `site`/`creator`" — and three pages had been violating it. That is
 * the shape this repo keeps learning: **a rule written in prose is not
 * a control.** A rule that has already been broken by three files is
 * not a rule; it is a sentence.
 *
 * THE RULES
 *
 *   1. `twitter-site-missing` — a `twitter:` block that declares
 *      `creator` but not `site`.
 *   2. `twitter-creator-missing` — a `twitter:` block that declares
 *      `site` but not `creator`.
 *   3. `twitter-handle-mismatch` — a handle that is not the canonical
 *      one declared by `lib/seo.ts`.
 *
 * The canonical handle is READ FROM `lib/seo.ts`, not hardcoded here,
 * so "the site's Twitter handle" has exactly one definition — the same
 * rule the internal-surface gate follows for "internal".
 *
 * A file may opt out with a trailing `audit:metadata-parity-ignore`
 * comment.
 *
 * Usage:
 *   node scripts/audit-metadata-parity.mjs                    # exit 1 on findings
 *   node scripts/audit-metadata-parity.mjs --report            # always exit 0
 *   node scripts/audit-metadata-parity.mjs --root <dir>        # scan another repo
 *   node scripts/audit-metadata-parity.mjs <file> [<file>...]  # scan specific files
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORE_MARKER = "audit:metadata-parity-ignore";

function parseArgs(argv) {
  const opts = { reportOnly: false, root: process.cwd(), files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") opts.reportOnly = true;
    else if (a === "--root") opts.root = resolve(argv[++i]);
    else if (!a.startsWith("-")) opts.files.push(resolve(a));
  }
  return opts;
}

/**
 * The canonical Twitter handle, read from the metadata factory.
 *
 * `lib/seo.ts` is the site's one metadata definition; if the brand
 * handle changes there, this gate follows it without being edited.
 */
export function canonicalHandles(root) {
  const seoPath = join(root, "lib", "seo.ts");
  if (!existsSync(seoPath)) return { site: null, creator: null };
  const src = readFileSync(seoPath, "utf8");
  const site = src.match(/site:\s*["'`]([^"'`]+)["'`]/);
  const creator = src.match(/creator:\s*["'`]([^"'`]+)["'`]/);
  return {
    site: site ? site[1] : null,
    creator: creator ? creator[1] : null,
  };
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

/** The matching close brace for the opener at `start`. */
function matchPair(src, start, open, close) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/** Blank out comments, preserving length and line breaks. */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (let j = i; j < stop; j++) out += src[j] === "\n" ? "\n" : " ";
      i = stop;
    } else if (two === "//") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      out += " ".repeat(j - i);
      i = j;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

/**
 * Every `twitter:` block in a file, as `{ index, body }`.
 *
 * The block extent is found by brace matching, not by scanning to the
 * next `}` — a block containing a nested object (`images: [{ … }]`)
 * would otherwise be cut short.
 */
export function twitterBlocks(src) {
  const code = stripComments(src);
  const out = [];
  const re = /\btwitter\s*:\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    const brace = code.indexOf("{", m.index);
    const end = matchPair(code, brace, "{", "}");
    if (end < 0) continue;
    out.push({ index: brace, body: code.slice(brace + 1, end) });
    re.lastIndex = end;
  }
  return out;
}

/** The handle a block declares for `key`, if any. */
function handleOf(body, key) {
  const m = body.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
  return m ? m[1] : null;
}

/** Scan one file. */
export function scanFile(path, root, canonical) {
  const src = readFileSync(path, "utf8");
  if (src.split("\n").some((l) => l.includes(IGNORE_MARKER))) return [];

  const rel = relative(root, path);
  const findings = [];

  for (const block of twitterBlocks(src)) {
    const site = handleOf(block.body, "site");
    const creator = handleOf(block.body, "creator");

    if (site && !creator) {
      findings.push({
        rule: "twitter-creator-missing",
        file: rel,
        line: lineAt(src, block.index),
        detail:
          `the \`twitter\` block declares \`site: "${site}"\` but not \`creator\`. ` +
          `Next.js REPLACES a metadata block rather than merging it, so this page's ` +
          `card loses the creator handle the factory in lib/seo.ts emits.`,
      });
    }
    if (creator && !site) {
      findings.push({
        rule: "twitter-site-missing",
        file: rel,
        line: lineAt(src, block.index),
        detail:
          `the \`twitter\` block declares \`creator: "${creator}"\` but not \`site\`. ` +
          `Next.js REPLACES a metadata block rather than merging it, so this page's ` +
          `card loses the site handle the factory in lib/seo.ts emits.`,
      });
    }
    for (const [key, value] of [["site", site], ["creator", creator]]) {
      const expected = canonical[key];
      if (value && expected && value !== expected) {
        findings.push({
          rule: "twitter-handle-mismatch",
          file: rel,
          line: lineAt(src, block.index),
          detail:
            `the \`twitter\` block declares \`${key}: "${value}"\`, but lib/seo.ts ` +
            `declares \`${expected}\`. One handle, one definition.`,
        });
      }
    }
  }
  return findings;
}

function main() {
  const { reportOnly, root, files } = parseArgs(process.argv.slice(2));
  const canonical = canonicalHandles(root);

  const targets =
    files.length > 0
      ? files
      : walkFiles(join(root, "app")).filter((f) => /\.(tsx|ts|jsx|js)$/.test(f));

  const findings = [];
  let checked = 0;
  for (const file of targets) {
    const src = readFileSync(file, "utf8");
    if (!/\btwitter\s*:/.test(src)) continue;
    checked++;
    findings.push(...scanFile(file, root, canonical));
  }

  const rules = [
    "twitter-site-missing",
    "twitter-creator-missing",
    "twitter-handle-mismatch",
  ];

  if (!findings.length) {
    console.log(
      `[metadata-parity] ${rules.length} rule(s) ran over ${checked} file(s) with a \`twitter\` ` +
        `block — no findings. Every override re-declares the handles lib/seo.ts emits ` +
        `(site ${canonical.site ?? "?"}, creator ${canonical.creator ?? "?"}).`,
    );
    return 0;
  }

  console.error(
    `[metadata-parity] ${findings.length} finding(s) — ${rules.length} rule(s) ran over ` +
      `${checked} file(s) with a \`twitter\` block:`,
  );
  for (const f of findings) {
    console.error(`  ${f.rule}  ${f.file}:${f.line} — ${f.detail}`);
  }
  console.error(
    "[metadata-parity] Next.js replaces a metadata block rather than merging it, so an " +
      "override that drops a handle drops it from the rendered card. Keep the two handles " +
      "in step with lib/seo.ts.",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
