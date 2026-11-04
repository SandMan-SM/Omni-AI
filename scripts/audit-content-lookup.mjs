#!/usr/bin/env node
/**
 * Gate: a page must not answer HTTP 404 because a database READ FAILED.
 *
 * Why this exists
 *
 * Supabase never throws. A read that fails — a dropped connection, a
 * statement timeout, a pool exhaustion — comes back as `{ data: null,
 * error: {...} }`, which is byte-for-byte the same shape as a read that
 * found nothing. Every page that destructured `{ data }` and called
 * `notFound()` on a falsy value was therefore making a claim it could
 * not support.
 *
 * That is not theoretical. On 2026-11-04 the live sweep caught five
 * published newsletter issues answering HTTP 404 — five URLs the
 * sitemap advertises — because their database read ran past a 2.5 s
 * timeout and the timeout's `null` was read as "no row with that slug".
 * Every one of them answered HTTP 200 when asked again a minute later.
 *
 * The two answers mean opposite things to a search engine:
 *
 *   no row            -> 404 is correct. The URL should leave the index.
 *   the lookup FAILED -> 404 is a lie. The URL should stay, and be retried.
 *
 * A 404 tells a crawler to forget the page; a 500 tells it to come back.
 * Only the first is true when the row is genuinely missing.
 *
 * THE RULE
 *
 *   const row = requireLookup(await lookupContent(() => sb.from(…).maybeSingle()));
 *   if (!row) notFound();
 *
 * `lookupContent` classifies the outcome as found / missing / failed;
 * `requireLookup` turns a failed lookup into a thrown error, which the
 * route's `error.tsx` renders as a retryable 500. A genuine absence still
 * produces a clean 404.
 *
 * The rules
 *
 *   1. `lookup-error-becomes-notfound` — an `if (error)` branch calls
 *      `notFound()`. The author explicitly captured the error and then
 *      answered "this page does not exist" because of it.
 *
 *   2. `missing-lookup-not-distinguished` — the value a `notFound()`
 *      guard tests traces back to a single-row Supabase read that is
 *      NOT routed through `lookupContent`, so a failed read is
 *      indistinguishable from an absent row. The trace follows local
 *      helper functions, because the read almost never sits in the
 *      same function as the guard.
 *
 * The scanned surface is indexable pages (`app/…/page.tsx`) plus any
 * file passed on the command line. API route handlers are deliberately
 * OUT of scope: a 404 from an authenticated, non-indexed API endpoint
 * costs a crawler nothing, and 112 of them carry single-row reads. The
 * class that bit was a sitemap-advertised URL leaving the index.
 *
 * A line may opt out with a trailing `audit:content-lookup-ignore`
 * comment.
 *
 * Usage:
 *   node scripts/audit-content-lookup.mjs                    # exit 1 on findings
 *   node scripts/audit-content-lookup.mjs --report            # always exit 0
 *   node scripts/audit-content-lookup.mjs --root <dir>        # scan another repo
 *   node scripts/audit-content-lookup.mjs <file> [<file>...]  # scan specific files
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORE_MARKER = "audit:content-lookup-ignore";

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

/** Every file the gate reads. */
function collectFiles(root, explicit) {
  if (explicit.length) return explicit;
  const out = [];
  const appDir = join(root, "app");
  if (!existsSync(appDir)) return out;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/^page\.(tsx|ts|jsx|js)$/.test(entry)) out.push(full);
    }
  };
  walk(appDir);
  return out;
}

/** Line number for a character offset. */
function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/** The matching close paren/brace for the opener at `start`. */
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

/** Split on a separator that is not nested inside brackets. */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const c of text) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === sep && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts;
}

/** The text of an expression starting at `start` up to its `;` at depth 0. */
function readInitializer(src, start) {
  let depth = 0;
  for (let i = start; i < src.length && i < start + 2000; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return src.slice(start, i);
      depth--;
    } else if (c === ";" && depth === 0) {
      return src.slice(start, i);
    }
  }
  return src.slice(start, start + 2000);
}

/** Identifiers a condition tests for absence, e.g. `!row` -> ["row"]. */
function testedIdentifiers(condition) {
  const ids = new Set();
  const re = /!\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?/g;
  let m;
  while ((m = re.exec(condition))) ids.add(m[1]);
  return [...ids];
}

/**
 * Every single-row read in `text`, each as the statement that contains it.
 * A read is DISTINGUISHED when its statement routes through
 * `lookupContent(`, and unclassified otherwise.
 */
function readStatements(text) {
  const out = [];
  const re = /\.(?:single|maybeSingle)\(\)/g;
  let m;
  while ((m = re.exec(text))) {
    const semi = text.lastIndexOf(";", m.index);
    const start = semi >= 0 ? semi + 1 : 0;
    const paren = text.indexOf("(", m.index);
    let end = m.index + m[0].length;
    if (paren >= 0) {
      const close = matchPair(text, paren, "(", ")");
      if (close > 0) end = close + 1;
    }
    const statement = text.slice(start, end);
    out.push({
      statement,
      offset: start,
      classified: /\blookupContent\s*\(/.test(statement),
    });
  }
  return out;
}

/**
 * The `{` that opens a function body, given the position just after its
 * parameter list.
 *
 * A TypeScript return type sits between the two — `Promise<Landing | null>`,
 * `Promise<{ page: LandingPage } | null>` — so a naive "first `{` after
 * the `)`" lands inside the annotation instead of on the body.
 */
function findBodyStart(src, afterParams) {
  let i = afterParams;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === "=" && src[i + 1] === ">") {
    i += 2;
    while (i < src.length && /\s/.test(src[i])) i++;
    return src[i] === "{" ? i : -1;
  }
  if (src[i] === ":") {
    i++;
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "<") depth++;
      else if (c === ">") {
        if (src[i - 1] !== "=") depth--;
      } else if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      else if (c === "{") {
        if (depth === 0) {
          // Either the body, or a bare object type in the annotation. A
          // bare object type is followed by `;` or `,`; a body is not.
          const close = matchPair(src, i, "{", "}");
          if (close < 0) return -1;
          let after = close + 1;
          while (after < src.length && /\s/.test(src[after])) after++;
          if (src[after] === ";" || src[after] === ",") {
            i = close + 1;
            continue;
          }
          return i;
        }
        depth++;
      } else if (c === "}") {
        if (depth === 0) return -1;
        depth--;
      } else if (c === ";" && depth === 0) {
        return -1;
      }
      i++;
    }
    return -1;
  }
  return src[i] === "{" ? i : -1;
}

/** Local function declarations in a file: name -> body text. */
function collectLocalFunctions(src) {
  const fns = new Map();
  const add = (name, parenStart) => {
    if (fns.has(name)) return;
    const parenEnd = matchPair(src, parenStart, "(", ")");
    if (parenEnd < 0) return;
    const b = findBodyStart(src, parenEnd + 1);
    if (b < 0) return;
    const end = matchPair(src, b, "{", "}");
    if (end < 0) return;
    fns.set(name, { body: src.slice(b, end + 1), offset: b });
  };
  const decl = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = decl.exec(src))) add(m[1], src.indexOf("(", m.index));
  const arrow = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
  while ((m = arrow.exec(src))) add(m[1], src.indexOf("(", m.index));
  return fns;
}

/**
 * Find where `id` is bound, searching only before `before`.
 * Handles `const id = …`, `const { data: id } = …` and
 * `const [id, …] = await Promise.all([…])`.
 */
function findBinding(src, id, before) {
  const candidates = [];

  const plain = new RegExp(`(?:const|let|var)\\s+${id}\\s*=`, "g");
  let m;
  while ((m = plain.exec(src))) {
    if (m.index >= before) break;
    const eq = src.indexOf("=", m.index + m[0].length - 1);
    if (eq < 0) continue;
    candidates.push({ start: eq + 1, expr: readInitializer(src, eq + 1) });
  }

  const destructured = new RegExp(
    `(?:const|let|var)\\s*\\{([^}]*)\\bdata\\s*:\\s*${id}\\b([^}]*)\\}\\s*=`,
    "g"
  );
  while ((m = destructured.exec(src))) {
    if (m.index >= before) break;
    const eq = src.indexOf("=", m.index + m[0].length - 1);
    if (eq < 0) continue;
    candidates.push({ start: eq + 1, expr: readInitializer(src, eq + 1) });
  }

  const array = /(?:const|let|var)\s*\[([^\]]*)\]\s*=/g;
  while ((m = array.exec(src))) {
    if (m.index >= before) break;
    const names = splitTopLevel(m[1], ",").map((p) => p.trim());
    const idx = names.findIndex((n) => n === id || n.split(":")[0].trim() === id);
    if (idx < 0) continue;
    const eq = src.indexOf("=", m.index + m[0].length - 1);
    if (eq < 0) continue;
    const init = readInitializer(src, eq + 1);
    const bracket = init.indexOf("[");
    if (bracket < 0) continue;
    const close = matchPair(init, bracket, "[", "]");
    if (close < 0) continue;
    const elements = splitTopLevel(init.slice(bracket + 1, close), ",");
    if (idx >= elements.length) continue;
    candidates.push({ start: eq + 1, expr: elements[idx].trim() });
  }

  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (c.start > best.start ? c : best));
}

/**
 * Collect the single-row reads that could decide the page's 404.
 *
 * `expr` is the value the guard tests. If it is itself a read, that is
 * the candidate. If it is a call to a local helper, the helper's body is
 * where the read lives — which is where it almost always lives, because
 * a page rarely queries inline.
 */
function resolveReads(expr, fns, depth = 0) {
  const reads = readStatements(expr);
  const unclassified = reads.filter((r) => !r.classified);
  if (depth >= 3) return unclassified;
  for (const [name, info] of fns) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(expr)) continue;
    const inner = resolveReads(info.body, fns, depth + 1);
    for (const r of inner) unclassified.push({ ...r, via: name });
  }
  return unclassified;
}

/** Rule 1 — an error branch that answers "not found". */
function findErrorNotFound(src) {
  const findings = [];
  const re = /\bif\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const parenStart = m.index + m[0].length - 1;
    const parenEnd = matchPair(src, parenStart, "(", ")");
    if (parenEnd < 0) continue;
    const condition = src.slice(parenStart + 1, parenEnd);
    if (!/\b(?:error|err)\b/.test(condition)) continue;
    // A NEGATED test (`if (!error)`) is the healthy branch.
    if (/!\s*\(?\s*(?:error|err)\b/.test(condition)) continue;
    // A compound test like `if (error && !notFound)` is not our shape.
    if (/&&|\|\|/.test(condition)) continue;

    let body;
    let bodyStart;
    let after = parenEnd + 1;
    while (after < src.length && /\s/.test(src[after])) after++;
    if (src[after] === "{") {
      const end = matchPair(src, after, "{", "}");
      if (end < 0) continue;
      body = src.slice(after, end);
      bodyStart = after;
    } else {
      const semi = src.indexOf(";", after);
      if (semi < 0) continue;
      body = src.slice(after, semi);
      bodyStart = after;
    }
    if (!body.includes("notFound(")) continue;
    findings.push({
      rule: "lookup-error-becomes-notfound",
      line: lineAt(src, bodyStart),
      detail:
        `an \`if (${condition.trim()})\` branch calls notFound(), so a FAILED read ` +
        `answers HTTP 404 — the same answer as "this page does not exist". ` +
        `Route the read through lookupContent() and requireLookup() so a failure is a 500.`,
    });
  }
  return findings;
}

/** Rule 2 — a notFound() guard whose tested row came from an unclassified read. */
function findUnclassifiedGuard(src) {
  const findings = [];
  const fns = collectLocalFunctions(src);
  const re = /\bnotFound\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const callStart = m.index;
    const before = src.slice(0, callStart);
    const ifIdx = before.lastIndexOf("if");
    if (ifIdx < 0) continue;
    const parenStart = src.indexOf("(", ifIdx);
    if (parenStart < 0 || parenStart > callStart) continue;
    const parenEnd = matchPair(src, parenStart, "(", ")");
    if (parenEnd < 0 || parenEnd > callStart) continue;
    const condition = src.slice(parenStart + 1, parenEnd);

    for (const id of testedIdentifiers(condition)) {
      const binding = findBinding(src, id, callStart);
      if (!binding) continue;
      const reads = resolveReads(binding.expr, fns);
      for (const read of reads) {
        const via = read.via ? ` (read inside \`${read.via}()\`)` : "";
        findings.push({
          rule: "missing-lookup-not-distinguished",
          line: lineAt(src, binding.start),
          detail:
            `\`${id}\` — tested by \`if (${condition.trim()})\` before notFound(), ` +
            `traces to a single-row Supabase read${via} that does not go through ` +
            `lookupContent(). A failed read is then indistinguishable from an ` +
            `absent row, so the page answers 404 for a page that exists.`,
        });
      }
    }
  }
  return findings;
}

function scanFile(path, root) {
  const src = readFileSync(path, "utf8");
  for (const line of src.split("\n")) {
    if (line.includes(IGNORE_MARKER)) return [];
  }
  const file = relative(root, path);
  const findings = [];
  for (const f of [...findErrorNotFound(src), ...findUnclassifiedGuard(src)]) {
    findings.push({ ...f, file });
  }
  return findings;
}

function main() {
  const { reportOnly, root, files } = parseArgs(process.argv.slice(2));
  const targets = collectFiles(root, files);
  const findings = [];
  for (const file of targets) findings.push(...scanFile(file, root));

  if (!findings.length) {
    console.log(
      `[content-lookup] ${targets.length} page(s) checked, no findings — ` +
        `no page answers HTTP 404 because a database read failed.`,
    );
    return 0;
  }

  console.error(`[content-lookup] ${findings.length} finding(s) in ${targets.length} page(s):`);
  for (const f of findings) {
    console.error(`  ${f.rule}  ${f.file}:${f.line} — ${f.detail}`);
  }
  console.error(
    "[content-lookup] a failed read is not a missing row. A 404 tells a crawler to forget " +
      "the URL; a 500 tells it to come back. Use lookupContent()/requireLookup() from " +
      "lib/server/content-lookup.ts.",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
