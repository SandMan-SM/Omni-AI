#!/usr/bin/env node
/**
 * Route-structure gate: a loading.tsx must not sit above a notFound().
 *
 * Why this exists
 *
 * `loading.tsx` is the Next.js way to give a route a skeleton. It works by
 * wrapping the segment's children in a Suspense boundary, which means the
 * shell is flushed to the browser BEFORE the page's data resolves.
 *
 * That is fine for a page that always renders. It is not fine for a page
 * that may 404: `notFound()` throws, and Next.js turns that throw into a
 * 404 status — but only if the throw happens BEFORE the response has
 * started streaming. Inside a Suspense boundary, the shell has already
 * been sent with a 200, so the status can no longer be changed. The
 * not-found UI renders, and the response is a **200 soft-404**.
 *
 * This was not theoretical. Six loading.tsx files were added to public
 * routes that fetch from Supabase and then call `notFound()` when the slug
 * does not resolve. Every one of them turned its 404 into a 200:
 *
 *   /lp/not-a-real-xyz                        404 -> 200
 *   /partners/not-a-real-xyz                  404 -> 200
 *   /p/omnileads/not-a-real-xyz               404 -> 200
 *   /federation/case-studies/not-a-real-xyz   404 -> 200
 *   /newsletter/not-a-real-issue-xyz          404 -> 200
 *
 * A soft-404 is worse than a missing skeleton in two ways: search engines
 * index it as a real page (a 404 is the signal to drop it), and every
 * crawler that wanders a slug space manufactures an indexable URL.
 *
 * So the rule is narrow and absolute:
 *
 *   A loading.tsx may not be added to a segment whose subtree contains a
 *   page that calls notFound().
 *
 * Note the "subtree", not just the segment. `app/newsletter/loading.tsx`
 * also breaks `app/newsletter/[slug]/page.tsx`, because the Suspense
 * boundary at the /newsletter segment wraps the [slug] segment as well.
 *
 * The alternative to a route-level loading.tsx is an inner <Suspense> in
 * the page, placed so the notFound() decision sits OUTSIDE the boundary.
 * That is only possible when the existence check is cheap and the slow
 * part is something else — on this site the check and the fetch are the
 * same await, so it is not possible, and the correct answer is to leave
 * the route without a skeleton. A route that 404s correctly beats a route
 * with a prettier loader.
 *
 * Usage: npx tsx scripts/audit-route-structure.ts
 * Exit:  0 no findings, 1 findings, 2 the app directory is unreadable
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(process.cwd());
const APP_DIR = path.join(ROOT, "app");

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-prod", ".turbo", ".git", "dist", "coverage"]);

type Finding = {
  rule: string;
  file: string;
  line: number;
  detail: string;
};

const findings: Finding[] = [];

/** Every FILE under a directory, at any depth. */
function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function join(...parts: string[]): string {
  return path.join(...parts);
}

/** Every source file under a segment directory. */
function segmentFiles(segment: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(full);
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  visit(segment);
  return out;
}

/** The line a `notFound()` call sits on. */
function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

if (!fs.existsSync(APP_DIR)) {
  console.error("[route-structure] no app/ directory — nothing to check.");
  process.exit(2);
}

const segments = fs
  .readdirSync(APP_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

/**
 * Every loading.tsx under app/, at any depth.
 *
 * Depth matters: `app/lp/[slug]/loading.tsx` is nested two segments down,
 * and a scan that only looked at the immediate children of app/ would
 * never see it — which is exactly the file that caused the regression.
 */
function loadingFiles(dir: string): string[] {
  const out: string[] = [];
  for (const sub of walk(dir)) {
    if (path.basename(sub) === "loading.tsx") out.push(sub);
  }
  return out;
}

let checked = 0;

for (const loadingFile of loadingFiles(APP_DIR)) {
  const segmentDir = path.dirname(loadingFile);

  checked += 1;

  // Everything under this segment, including nested ones.
  const offenders: Array<{ file: string; line: number }> = [];
  for (const file of segmentFiles(segmentDir)) {
    let src: string;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const re = /\bnotFound\s*\(\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      offenders.push({ file: path.relative(ROOT, file), line: lineOf(src, m.index) });
    }
  }

  if (!offenders.length) continue;

  const listed = offenders
    .slice(0, 5)
    .map((o) => `${o.file}:${o.line}`)
    .join(", ");
  findings.push({
    rule: "loading-above-not-found",
    file: path.relative(ROOT, loadingFile),
    line: 1,
    detail:
      `${path.relative(ROOT, loadingFile)} wraps a segment that calls notFound() (${listed}` +
      `${offenders.length > 5 ? `, +${offenders.length - 5} more` : ""}). ` +
      "The Suspense boundary flushes a 200 before the page resolves, so notFound() can no longer " +
      "set a 404 status — the 404 becomes a soft 404 that search engines index. " +
      "Move the skeleton INSIDE the page, below the notFound() check, or leave the route without one.",
  });
}

console.log(`\nscanned ${checked} loading.tsx segment(s) — ${findings.length} finding(s) across 1 rule`);
for (const f of findings) {
  console.log(`\n  ${f.rule}  ${f.file}:${f.line}`);
  console.log(`    ${f.detail}`);
}
if (findings.length > 0) process.exit(1);
