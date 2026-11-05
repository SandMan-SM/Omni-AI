#!/usr/bin/env node
/**
 * Gate: an internal surface must not serve privileged data to an
 * anonymous caller.
 *
 * Why this exists
 *
 * `robots.txt` and `robots: { index: false }` are CRAWLER directives.
 * They keep a compliant bot out of the index; they do nothing about a
 * person who types the URL, a scraper, or a competitor who reads a link
 * from a shared screen. This repo had learned that once already — the
 * robots prefixes were already written without trailing slashes so the
 * bare `/admin` URL was blocked too — and the lesson had not reached
 * the data layer.
 *
 * On 2026-11-04 this class was found live in production, not in theory:
 *
 *   GET /dashboard/council      -> 200, 120 KB, the full Council Codex
 *   GET /dashboard/federation   -> 200,  70 KB, the cross-promo funnel
 *   GET /api/federation/health  -> 200,   3 KB, no credential, CORS `*`,
 *                                  CDN-cacheable, and — for all 16
 *                                  portfolio clients — the 30-day LEAD
 *                                  COUNT, the traffic volume, the
 *                                  last-event timestamp and a health
 *                                  verdict (active / quiet / stale).
 *
 * The last one is a competitor's roadmap: which clients are growing,
 * which have gone quiet, which are one renewal away from churn. And
 * "no secrets, no PII" was true and was not the question. A lead COUNT
 * is not personal data; it is confidential BUSINESS data. The answer
 * to "is this public?" is a credential check, not a field-name check.
 *
 * THE RULES
 *
 *   1. `internal-page-privileged-read` — a SERVER component under a
 *      robots-disallowed prefix reads privileged data with the service
 *      role. The document request carries no credential (the operator's
 *      credential lives in `localStorage`, so it cannot travel on a
 *      server-rendered request at all), so the rendered HTML ships the
 *      data to anyone with the URL. The fix is the repo's established
 *      idiom (`/api/dashboard/metrics`): move the read into a route
 *      behind `requireAdmin()` and have the client fetch it with the
 *      `omni_token` bearer.
 *
 *   2. `unauthenticated-tenant-metrics` — a route handler with NO
 *      credential check emits PER-TENANT business metrics (lead counts,
 *      traffic volumes, last-activity timestamps). The aggregate is
 *      fine — that is what a liveness check needs. The per-tenant
 *      breakdown is not.
 *
 * WHY THE POPULATION IS DERIVED, NOT HARDCODED
 *
 * Rule 1's page population comes from `app/robots.ts` — the same list
 * of internal prefixes the site already declares. One source of truth:
 * a prefix the operator marks internal is automatically protected here.
 *
 * A line may opt out with a trailing `audit:internal-surface-ignore`
 * comment.
 *
 * Usage:
 *   node scripts/audit-internal-surface.mjs                    # exit 1 on findings
 *   node scripts/audit-internal-surface.mjs --report            # always exit 0
 *   node scripts/audit-internal-surface.mjs --root <dir>        # scan another repo
 *   node scripts/audit-internal-surface.mjs <file> [<file>...]  # scan specific files
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORE_MARKER = "audit:internal-surface-ignore";

/**
 * The credential checks that make a route "not anonymous".
 *
 * Every one of these is a REAL check against a secret or a server-side
 * session. A request header the caller chooses (`x-vercel-cron`,
 * `User-Agent`) is deliberately absent — the repo's own rule is that a
 * request header is not a credential, and `audit:cron-auth` enforces it.
 */
const AUTH_MARKERS = [
  /requireAdmin\s*\(/,
  /requireAdminOrBrandMember\s*\(/,
  /authorizeCronOrAdmin\s*\(/,
  /assertCronCaller\s*\(/,
  /requireAuth\s*\(/,
  /requireUser\s*\(/,
  /requireSession\s*\(/,
  /requireCredential\s*\(/,
  /requireSocialCalendarOwner\s*\(/,
  /constantTimeEqual\s*\(/,
  /timingSafeEqual\s*\(/,
  /CRON_SECRET/,
  /ADMIN_API_KEY/,
  /auth\.getUser\s*\(/,
  /auth\.getSession\s*\(/,
  /getUser\s*\(/,
  /getSession\s*\(/,
  // A webhook signature is a credential check too.
  /constructEvent\s*\(/,
  /verifySignature\s*\(/,
];

/**
 * A FIELD that carries a per-tenant BUSINESS METRIC.
 *
 * Counts, windows and last-activity timestamps. Not names, not emails,
 * not ids — a metric is the confidential thing here, and it is the
 * thing that turns an endpoint into a portfolio report.
 *
 * Written as a KEY (`leads_30d:`), not a bare word: `leadSenderFor` in
 * an import is not a metric, and neither is `leadsTable`. Only a
 * declared field is.
 */
const METRIC_KEY =
  /["'`]?\b(leads?|events?|impressions?|clicks?|conversions?|sessions?|visits?|pageviews?|revenue)\w*["'`]?\s*:/i;

/**
 * A response key that names a COLLECTION OF TENANTS.
 *
 * `slugs`, `slugs_by_health`, `tenants`, `clients`, `businesses`,
 * `brands` — a key whose value is one entry per client in the
 * portfolio. The tenant word must START the key, so `target_slug` (a
 * field ON one tenant) does not qualify: the rule is about the
 * BREAKDOWN, not about one entry.
 */
const TENANT_COLLECTION_KEY =
  /["'`]?\b(slugs|tenants|clients|businesses|brands|portfolio)\w*["'`]?\s*:/;

/** A privileged read: the service-role client that bypasses RLS. */
const PRIVILEGED_READ =
  /createAdminClient\s*\(|SUPABASE_SERVICE_ROLE|service_role/i;

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
 * The internal prefixes, read from `app/robots.ts`.
 *
 * Parsed rather than hardcoded so the gate and the site's own
 * declaration cannot drift: a prefix the operator marks internal is
 * automatically protected here, and one they unmark stops being
 * audited without anyone editing this file.
 */
export function internalPrefixes(root) {
  const robotsPath = join(root, "app", "robots.ts");
  if (!existsSync(robotsPath)) return [];
  const src = readFileSync(robotsPath, "utf8");
  const block = src.match(/disallow\s*:\s*\[([\s\S]*?)\]/);
  if (!block) return [];
  const prefixes = [];
  const re = /["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(block[1]))) {
    const p = m[1].trim();
    // "/api/" is a route namespace, not a page namespace — page rules
    // do not apply to it.
    if (!p || p.startsWith("/api")) continue;
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

/** Every `page.tsx` under `app/`. */
function collectPages(root) {
  return walkFiles(join(root, "app")).filter((f) => /(^|\/)page\.tsx$/.test(f));
}

/** Every `route.ts` under `app/`. */
function collectRoutes(root) {
  return walkFiles(join(root, "app")).filter((f) => /(^|\/)route\.ts$/.test(f));
}

/** Line number for a character offset. */
function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

function isClientComponent(src) {
  return /^\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n|\s)*["']use client["']/.test(src);
}

/**
 * Blank out comments, preserving length and line breaks.
 *
 * A doc comment that says "writes to inbound_<slug>_events" is a
 * description of behaviour, not behaviour. Matching against it is how
 * a gate starts crying wolf, and a gate that cries wolf gets ignored.
 */
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

function ignored(src) {
  return src.split("\n").some((l) => l.includes(IGNORE_MARKER));
}

/**
 * The repo modules a file imports, resolved to absolute paths.
 * Only `@/lib/…` and relative imports are followed; node_modules and
 * package imports are not part of this repo's code.
 */
function localImports(src, file, root) {
  const out = new Set();
  const dir = file.split("/").slice(0, -1);
  const re = /from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    let base = null;
    if (spec.startsWith("@/lib/")) base = join(root, "lib", spec.slice("@/lib/".length));
    else if (spec.startsWith("@/")) base = join(root, spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) {
      base = resolve(dir.join("/"), spec);
    }
    if (!base) continue;
    for (const cand of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ]) {
      if (existsSync(cand) && statSync(cand).isFile()) {
        out.add(cand);
        break;
      }
    }
  }
  return [...out];
}

/**
 * Rule 1 — an internal server component that performs a privileged read.
 *
 * The read is searched for in the page itself and, one and two levels
 * deep, in the repo modules it imports — because the read almost never
 * sits in the page. It sits in `lib/`, and the page renders whatever
 * the helper returned.
 */
export function findInternalPageReads(src, file, root, prefixes) {
  const findings = [];
  const rel = relative(root, file);
  const underPrefix = prefixes.find((p) => rel.startsWith(`app${p}/`));
  if (!underPrefix) return findings;
  if (isClientComponent(src)) return findings;

  const seen = new Set();
  const queue = [{ path: file, src: stripComments(src), depth: 0 }];
  while (queue.length) {
    const item = queue.shift();
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    const m = PRIVILEGED_READ.exec(item.src);
    if (m) {
      findings.push({
        rule: "internal-page-privileged-read",
        file: rel,
        line: lineAt(item.src, m.index),
        detail:
          `\`${rel}\` is a SERVER component under the internal prefix \`${underPrefix}\` ` +
          `and reads privileged data with the service-role client` +
          (item.path === file ? "." : ` (via \`${relative(root, item.path)}\`).`) +
          ` The document request carries no credential — the operator's token lives in ` +
          `localStorage, so it cannot travel on a server-rendered request — so this ` +
          `renders the data to anyone with the URL. Move the read into a route behind ` +
          `requireAdmin() and fetch it from the client with the \`omni_token\` bearer.`,
      });
      break;
    }
    if (item.depth >= 2) continue;
    for (const dep of localImports(item.src, item.path, root)) {
      queue.push({
        path: dep,
        src: stripComments(readFileSync(dep, "utf8")),
        depth: item.depth + 1,
      });
    }
  }
  return findings;
}

/**
 * Rule 2 — a route with no credential check that emits per-tenant
 * business metrics.
 *
 * Requires BOTH halves of the shape:
 *   - the payload is broken out per tenant (a collection key naming
 *     tenants, or an iteration over the tenant list), AND
 *   - the entries carry a business metric (a count, a window, a
 *     last-activity timestamp).
 *
 * The aggregate summary of the same route is fine — a liveness check
 * needs it — so the rule is about the per-tenant BREAKDOWN, not about
 * counting rows.
 */
export function findUnauthenticatedTenantMetrics(src, file, root) {
  const findings = [];
  const rel = relative(root, file);
  if (ignored(src)) return findings;

  const code = stripComments(src);

  const hasAuth = AUTH_MARKERS.some((re) => re.test(code));
  if (hasAuth) return findings;

  // A collection of tenants, one entry per client in the portfolio.
  const collection = TENANT_COLLECTION_KEY.exec(code);
  if (!collection) return findings;

  // ... whose entries carry a business metric.
  const metric = METRIC_KEY.exec(code);
  if (!metric) return findings;

  findings.push({
    rule: "unauthenticated-tenant-metrics",
    file: rel,
    line: lineAt(src, collection.index),
    detail:
      `\`${rel}\` has NO credential check (no requireAdmin(), no authorizeCronOrAdmin(), ` +
      `no session read) and emits a PER-TENANT BREAKDOWN — the response carries \`${collection[1]}\` ` +
      `and the entries carry business metrics (\`${metric[1]}\`). An anonymous caller reads the ` +
      `portfolio's volume and activity. The aggregate summary may stay public (a liveness ` +
      `check needs it); the per-tenant detail must be behind requireAdmin() and served ` +
      `\`private, no-store\`.`,
  });
  return findings;
}

/** Scan one file against both rules. */
export function scanFile(path, root, prefixes) {
  const src = readFileSync(path, "utf8");
  if (ignored(src)) return [];
  const findings = [
    ...findInternalPageReads(src, path, root, prefixes),
    ...findUnauthenticatedTenantMetrics(src, path, root),
  ];
  return findings;
}

function main() {
  const { reportOnly, root, files } = parseArgs(process.argv.slice(2));
  const prefixes = internalPrefixes(root);

  const explicit = files.length > 0;
  const pages = explicit ? files.filter((f) => /page\.tsx$/.test(f)) : collectPages(root);
  const routes = explicit ? files.filter((f) => /route\.ts$/.test(f)) : collectRoutes(root);

  const findings = [];
  let rule1Ran = 0;
  let rule2Ran = 0;

  for (const page of pages) {
    const src = readFileSync(page, "utf8");
    const hits = findInternalPageReads(src, page, root, prefixes);
    if (hits.length) findings.push(...hits);
    else rule1Ran++;
  }
  for (const route of routes) {
    const src = readFileSync(route, "utf8");
    const hits = findUnauthenticatedTenantMetrics(src, route, root);
    if (hits.length) findings.push(...hits);
    else rule2Ran++;
  }

  const rules = [
    "internal-page-privileged-read",
    "unauthenticated-tenant-metrics",
  ];

  if (!findings.length) {
    console.log(
      `[internal-surface] ${rules.length} rule(s) ran — ` +
        `internal-page-privileged-read over ${pages.length} page(s) ` +
        `(${prefixes.length} internal prefix(es) from app/robots.ts), ` +
        `unauthenticated-tenant-metrics over ${routes.length} route(s) — ` +
        `no findings. No internal surface serves privileged data to an anonymous caller.`,
    );
    return 0;
  }

  console.error(
    `[internal-surface] ${findings.length} finding(s) — ${rules.length} rule(s) ran over ` +
      `${pages.length} page(s) and ${routes.length} route(s):`,
  );
  for (const f of findings) {
    console.error(`  ${f.rule}  ${f.file}:${f.line} — ${f.detail}`);
  }
  console.error(
    "[internal-surface] noindex is not protection. Robots keeps crawlers out of the index; " +
      "it does nothing for a person with the URL. The protection is a credential check on the " +
      "data read, and the credential has to travel with the request.",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
