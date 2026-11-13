#!/usr/bin/env node
/**
 * Gate: a PUBLIC surface must not resolve a retired federation tenant.
 *
 * Why this exists
 *
 * On 2026-11-09 the operator retired one tenant from the federation
 * ("A Chat with Liz" / `achatwithliz`). The retirement was applied BY HAND
 * across roughly thirty files — the deny list was added to the mail
 * fan-out, the newsletter audience, the social-post filter, the contact
 * hash list — and the deny list itself is checked in, so those paths hold.
 *
 * A hand application is a hand application. Thirty files is more than a
 * person can re-check on the next retirement, and the NEXT retirement
 * would have to be applied by hand again. Measured on 2026-11-12, five
 * PUBLIC surfaces resolved a business straight out of `omni_businesses`
 * with no retirement filter at all:
 *
 *   app/partners/[slug]/page.tsx           → /partners/<slug> renders
 *   app/partners/[slug]/opengraph-image.tsx → the retired NAME on the card
 *   app/book/[business]/page.tsx           → /book/<id> renders
 *   app/book/[business]/layout.tsx         → the retired NAME in the title
 *   app/lp/[slug]/page.tsx                 → the retired NAME + contact
 *
 * The live table happened to hold no retired row (the tenant's registry
 * row was deleted on retirement), so the leak was LATENT, not live. That
 * is exactly the class that comes back: the row is re-added, an import
 * replays, a new alias is registered — and a public page serves a tenant
 * the operator removed. The `/partners/[slug]` lookup matches on slug OR
 * name, so an ALIAS (`/partners/A%20Chat%20with%20Liz`) would have
 * resolved it too.
 *
 * The doctrine the repo already writes down: a fix is not a fix, a gate
 * is a class. So this gate holds the class.
 *
 * THE RULE
 *
 *   1. `public-registry-read-without-retirement-filter` — a PUBLIC page
 *      (a page, layout, or OG/Twitter image that is not under a
 *      robots-disallowed prefix) reads a TENANT REGISTRY table directly,
 *      and the file does not apply a retirement guard to what it read.
 *
 * WHY INTERNAL READERS ARE EXEMPT
 *
 * The ~30 internal readers of `omni_businesses` — the AGI layer, the
 * council routes, the cron jobs, the dashboard — are unfiltered ON
 * PURPOSE. Historical records stay in storage; the dashboard shows the
 * operator what happened, and a retired tenant's row is part of that
 * record. Only the PUBLIC projections are the problem: those are what a
 * stranger can reach.
 *
 * WHY THE POPULATION IS DERIVED
 *
 * "Public" is read out of `app/robots.ts` — the same list the site
 * already declares as internal. One source of truth: a prefix the
 * operator marks internal is automatically exempt here, and one they
 * unmark stops being exempt without anyone editing this file. The
 * derivation is deliberately the INVERSE of `audit:internal-surface`:
 * that gate protects the prefixes, this one protects everything outside
 * them.
 *
 * WHY THE READ IS SCOPED TO THE FILE ITSELF
 *
 * The gate looks for a direct `.from("omni_businesses")` read in the
 * public file. It does not follow imports, because the public files that
 * reach the registry indirectly do so through
 * `/api/dashboard/businesses`, and that route ALREADY applies the
 * retirement filter. Following the import graph would report those files
 * as findings for a filter they already have — a gate that cries wolf
 * gets ignored.
 *
 * A line may opt out with a trailing `audit:federation-retirement-ignore`
 * comment.
 *
 * Usage:
 *   node scripts/audit-federation-retirement.mjs              # exit 1 on findings
 *   node scripts/audit-federation-retirement.mjs --report     # always exit 0
 *   node scripts/audit-federation-retirement.mjs --root <dir> # scan another repo
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORE_MARKER = "audit:federation-retirement-ignore";

/**
 * The tables that carry a TENANT IDENTITY.
 *
 * `omni_businesses` is the registry: one row per business in the
 * federation, carrying the slug, the name, the website and the contact
 * address. `omni_landing_pages` is the tenant's public campaign copy —
 * a landing page belongs to a business through `business_id`, so a page
 * that serves one is serving that tenant's projection.
 */
const REGISTRY_TABLES = ["omni_businesses", "omni_landing_pages"];

/**
 * The retirement guards, matched as CALL SITES.
 *
 * A bare word is how "the file mentions the deny list" becomes "the file
 * applies the deny list". These have to be CALLED — an import on its own
 * proves nothing, which is why the import statement (which has no call
 * parenthesis) does not satisfy the rule.
 */
const GUARDS = [
  "isActiveFederationRecord",
  "isRetiredFederationIdentity",
  "requireActiveFederationIdentity",
  "isRetiredFederationContact",
];

/** The file kinds that produce a public document. */
const PUBLIC_FILE_KINDS = [
  "page.tsx",
  "layout.tsx",
  "opengraph-image.tsx",
  "twitter-image.tsx",
  "route.ts",
];

/**
 * The internal prefixes, read from `app/robots.ts`.
 *
 * Parsed rather than hardcoded so the gate and the site's own
 * declaration cannot drift. `/api/` is kept here (unlike
 * `audit:internal-surface`, which does not need it) because an API route
 * is not a public document either.
 */
export function internalPrefixes(root) {
  const robotsPath = join(root, "app", "robots.ts");
  if (!existsSync(robotsPath)) return null;
  const src = readFileSync(robotsPath, "utf8");
  const block = src.match(/disallow\s*:\s*\[([\s\S]*?)\]/);
  if (!block) return null;
  const prefixes = [];
  const re = /["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(block[1]))) {
    const p = m[1].trim();
    if (!p) continue;
    prefixes.push(p.replace(/\/+$/, ""));
  }
  return [...new Set(prefixes)];
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

/** Every public-document file under `app/`. */
export function collectPublicFiles(root) {
  return walkFiles(join(root, "app")).filter((f) => {
    const name = f.split("/").pop();
    return PUBLIC_FILE_KINDS.some((kind) => name === kind || name === kind.replace(/\.tsx$/, ".ts"));
  });
}

/** Is this file under an internal prefix? */
export function isInternal(rel, prefixes) {
  return prefixes.some((p) => rel === `app${p}` || rel.startsWith(`app${p}/`));
}

/**
 * Blank out comments, preserving length and line breaks.
 *
 * A doc comment that says "reads omni_businesses" is a description of
 * behaviour, not behaviour.
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < -1 ? src.length : end + 2;
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

function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

function ignored(src) {
  return src.split("\n").some((l) => l.includes(IGNORE_MARKER));
}

/** Does this file read a tenant registry table? */
export function registryRead(code) {
  for (const table of REGISTRY_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`);
    const m = re.exec(code);
    if (m) return { table, index: m.index };
  }
  return null;
}

/** Does this file CALL a retirement guard? */
export function appliesRetirementGuard(code) {
  return GUARDS.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(code));
}

/**
 * Scan one file against the rule.
 */
export function scanFile(path, root, prefixes) {
  const src = readFileSync(path, "utf8");
  if (ignored(src)) return [];
  const rel = relative(root, path);
  if (isInternal(rel, prefixes)) return [];

  const code = stripComments(src);
  const read = registryRead(code);
  if (!read) return [];
  if (appliesRetirementGuard(code)) return [];

  return [
    {
      rule: "public-registry-read-without-retirement-filter",
      file: rel,
      line: lineAt(src, read.index),
      detail:
        `\`${rel}\` is a PUBLIC surface and reads the tenant registry table \`${read.table}\` ` +
        `without applying a retirement guard. A federation tenant the operator has retired ` +
        `keeps its history but loses its active projections — and a public page IS an active ` +
        `projection. If that tenant's row (or an ALIAS of it) is ever in the registry again, ` +
        `this page will serve it. Apply \`isActiveFederationRecord(row)\` from ` +
        `\`@/lib/federation-retirement\` to what the read returns, and 404 when the tenant is retired.`,
    },
  ];
}

function parseArgs(argv) {
  const opts = { reportOnly: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") opts.reportOnly = true;
    else if (a === "--root") opts.root = resolve(argv[++i]);
  }
  return opts;
}

function main() {
  const { reportOnly, root } = parseArgs(process.argv.slice(2));

  const prefixes = internalPrefixes(root);
  if (!prefixes) {
    console.error(
      "[federation-retirement] `app/robots.ts` could not be read, so the public/internal " +
        "split could not be derived. The result is UNKNOWN. This gate did not run.",
    );
    return 2;
  }

  const files = collectPublicFiles(root);
  const findings = [];
  for (const file of files) findings.push(...scanFile(file, root, prefixes));

  const rules = ["public-registry-read-without-retirement-filter"];
  const publicFiles = files.filter((f) => !isInternal(relative(root, f), prefixes));

  if (!findings.length) {
    console.log(
      `[federation-retirement] ${rules.length} rule(s) ran over ${publicFiles.length} public ` +
        `file(s) (${prefixes.length} internal prefix(es) from app/robots.ts) — no findings. ` +
        `No public surface resolves a retired federation tenant.`,
    );
    return 0;
  }

  console.error(
    `[federation-retirement] ${findings.length} finding(s) — ${rules.length} rule(s) ran over ` +
      `${publicFiles.length} public file(s):`,
  );
  for (const f of findings) {
    console.error(`  ${f.rule}  ${f.file}:${f.line} — ${f.detail}`);
  }
  console.error(
    "[federation-retirement] history stays; projections do not. A retired tenant must not " +
      "render on a public surface, and the check belongs in code that a gate can see.",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
