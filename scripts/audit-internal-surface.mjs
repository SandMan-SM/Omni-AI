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
 *   3. `internal-page-tenant-collection` — a SERVER component under an
 *      internal prefix RENDERS a per-tenant collection into the
 *      document. The document request carries no credential (the
 *      operator's token lives in `localStorage`), so the portfolio's
 *      operating state ships to anyone with the URL. This is the shape
 *      the control plane had: every client, its score, its gaps, its
 *      next action — 47 KB of the agency's book of business, served to
 *      an anonymous caller.
 *
 *   4. `unauthenticated-tenant-collection` — a route handler with NO
 *      credential check whose RESPONSE is a per-tenant collection. The
 *      shape is followed through the route's imports, because the
 *      collection is almost never declared in the route file — it is
 *      built in `lib/` and returned verbatim.
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

const ts = (await import("typescript")).default;

/**
 * The DERIVED credential verifiers, imported from the public-PII gate.
 *
 * WHY THIS IS AN IMPORT AND NOT A SECOND LIST
 *
 * "Does this route authenticate the caller?" had TWO hand-maintained
 * answers in this repo — a literal marker list here, and a list derived
 * from `lib/` in `audit-public-pii.mjs` — and session 64 showed what a
 * hand-typed list costs: it was missing four of this repo's own
 * verifiers, so five authenticated routes were classified PUBLIC. A
 * second list is how the same blindness comes back. There is now ONE
 * derivation, and both gates read it.
 */
const { deriveCredentialVerifiers, AUTH_MARKERS: SHARED_AUTH_MARKERS } = await import("./audit-public-pii.mjs");

const IGNORE_MARKER = "audit:internal-surface-ignore";

/**
 * The credential checks that make a route "not anonymous".
 *
 * Every one of these is a REAL check against a secret or a server-side
 * session. A request header the caller chooses (`x-vercel-cron`,
 * `User-Agent`) is deliberately absent — the repo's own rule is that a
 * request header is not a credential, and `audit:cron-auth` enforces it.
 *
 * THE LIST IS SHARED WITH `audit-public-pii.mjs`, not re-typed here.
 *
 * Session 65 measured what a second hand-typed list costs. The
 * internal-surface gate did not know `serviceAuthorized` or
 * `verifiedActor` — the two helpers three reporting routes authenticate
 * with — so those routes read as ANONYMOUS to this gate and produced
 * findings on routes that are in fact gated. A second list is how the
 * same blindness comes back, so there is now ONE list and both gates
 * read it.
 *
 * The shared markers are matched as CALL SITES, not as bare words. A
 * bare word is how "the route mentions a secret" becomes "the route
 * checks a secret" — the exact confusion this repo's rules forbid. A
 * secret's NAME on one side of a comparison is handled separately, by
 * the comparison patterns below.
 */
const AUTH_MARKERS = SHARED_AUTH_MARKERS.filter((m) => /[A-Za-z_$]/.test(m[0])).map((m) => {
  const name = m.replace(/\($/, "");
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`);
});

/**
 * A comparison against a SECRET — the shape a route uses when it checks
 * a bearer against `process.env.CRON_SECRET` without a helper.
 *
 * The name has to be on one side of the comparison; a route that only
 * NAMES the secret (in a comment, or by reading it) has not checked
 * anything.
 */
const SECRET_COMPARISON =
  /(?:constantTimeEqual|timingSafeEqual)\s*\([^)]*\b[A-Za-z_$][\w$]*(?:secret|token|key|credential)[\w$]*\b/i;

/** A `===` / `!==` comparison where one side is named like a secret. */
const SECRET_NAME_COMPARISON =
  /\b[A-Za-z_$][\w$]*(?:secret|token|key|credential)[\w$]*\b\s*(?:===|!==|==|!=)/i;

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

/**
 * A key that identifies ONE TENANT, unambiguously.
 *
 * The portfolio's clients are keyed `businessSlug` / `tenantSlug` /
 * `clientSlug` / `assetId`. These names cannot be anything else.
 */
const STRONG_TENANT_KEYS = ["businessSlug", "tenantSlug", "clientSlug", "assetId"];

/**
 * `slug` — a tenant key ONLY when something else says the entry is a
 * portfolio client.
 *
 * `slug` alone is the most overloaded word in this repo: a newsletter
 * POST has a slug, a membership TIER has a slug, a landing page has a
 * slug. None of those is a tenant, and treating them as one made the
 * gate report three routes that were not leaks. A `slug` qualifies only
 * alongside a field that names a client — a name, an agent, a surface, a
 * domain. `CLIENT_AGENT_REGISTRY` qualifies (`slug` + `businessName`);
 * a newsletter post does not (`slug` + `subject`).
 */
const WEAK_TENANT_KEYS = ["slug"];

/** The fields that say "this entry is a CLIENT of the agency". */
const PORTFOLIO_FIELDS = [
  "businessName",
  "agentName",
  "displayName",
  "assetId",
  "domain",
  "analyticsTenantSlugs",
];

/**
 * Is this object literal an entry in the agency's book of business?
 *
 * TRUE when it carries an unambiguous tenant key, or a `slug` plus a
 * field that only a portfolio client has.
 */
function isPortfolioEntry(keys) {
  if (keys.some((k) => STRONG_TENANT_KEYS.includes(k))) return true;
  if (keys.some((k) => WEAK_TENANT_KEYS.includes(k))) {
    return keys.some((k) => PORTFOLIO_FIELDS.includes(k));
  }
  return false;
}

/**
 * A key that holds a COLLECTION of tenants.
 *
 * Used by the render-side rule: a page that maps over one of these is
 * rendering the whole portfolio (or its queue) into the document.
 */
const COLLECTION_KEYS = [
  "businesses",
  "clients",
  "tenants",
  "brands",
  "portfolio",
  "slugs",
  "actionQueue",
];

function parseSource(src, fileName) {
  return ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

/**
 * Does this file RENDER a per-tenant collection?
 *
 * A `.map()` over a collection property, or over a local alias assigned
 * from one (`const topActions = snapshot.actionQueue.slice(0, 10)`).
 *
 * This is the render-side half of the rule: the leak is not "a module
 * holds a registry", it is "the registry is in the HTML".
 */
export function rendersTenantCollection(src, fileName = "page.tsx") {
  const source = parseSource(src, fileName);
  const aliases = new Set();
  const hits = [];

  // Pass 1 — local aliases derived from a collection.
  const collectAliases = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = node.initializer;
      const target =
        ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression)
          ? init.expression.expression
          : null;
      const key = target && ts.isPropertyAccessExpression(target) ? propertyName(target.name) : null;
      if (key && COLLECTION_KEYS.includes(key)) aliases.add(node.name.text);
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(source);

  // Pass 2 — a `.map()` over a collection or an alias.
  const collectMaps = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map"
    ) {
      const receiver = node.expression.expression;
      let key = null;
      if (ts.isPropertyAccessExpression(receiver)) key = propertyName(receiver.name);
      else if (ts.isIdentifier(receiver)) key = receiver.text;
      if (key && (COLLECTION_KEYS.includes(key) || aliases.has(key))) {
        const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
        hits.push({ line: pos.line + 1, key });
      }
    }
    ts.forEachChild(node, collectMaps);
  };
  collectMaps(source);

  return hits;
}

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
  const re = /from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const target = resolveModulePath(m[1], file, root);
    if (target) out.add(target);
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
export function findUnauthenticatedTenantMetrics(src, file, root, derived) {
  const findings = [];
  const rel = relative(root, file);
  if (ignored(src)) return findings;

  const code = stripComments(src);

  if (hasCredentialCheck(code, derived)) return findings;

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

/**
 * Does this route authenticate the caller?
 *
 * ONE definition, three sources:
 *   - the literal markers (a helper that checks a credential);
 *   - a comparison against a secret (the name has to be ON one side of
 *     the comparison — naming the secret is not checking it);
 *   - the DERIVED verifiers from `lib/` — a function whose body proves
 *     a credential, resolved transitively.
 *
 * The derived set is what keeps a new verifier from being invisible here
 * (session 64's lesson: a hand-typed marker list was missing four of
 * this repo's own verifiers, so five authenticated routes read as
 * PUBLIC).
 */
export function hasCredentialCheck(code, derived = new Set()) {
  if (AUTH_MARKERS.some((re) => re.test(code))) return true;
  if (SECRET_COMPARISON.test(code)) return true;
  if (SECRET_NAME_COMPARISON.test(code)) return true;
  for (const name of derived) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(code)) return true;
  }
  return false;
}

/**
 * Rule 3 — an internal SERVER component that RENDERS a per-tenant
 * collection into the document.
 *
 * The document request carries no credential — the operator's token
 * lives in `localStorage` — so whatever a server component renders
 * travels to anyone with the URL. Every other page under an internal
 * prefix in this repo is a CLIENT component for exactly that reason;
 * the ones that were server components (the council view and the
 * federation view, both fixed on 2026-11-04) were the ones that leaked.
 */
export function findInternalPageTenantCollections(src, file, root, prefixes) {
  const findings = [];
  const rel = relative(root, file);
  const underPrefix = prefixes.find((p) => rel.startsWith(`app${p}/`));
  if (!underPrefix) return findings;
  if (isClientComponent(src)) return findings;
  if (ignored(src)) return findings;

  const hits = rendersTenantCollection(src, rel);
  for (const hit of hits) {
    findings.push({
      rule: "internal-page-tenant-collection",
      file: rel,
      line: hit.line,
      detail:
        `\`${rel}\` is a SERVER component under the internal prefix \`${underPrefix}\` and ` +
        `renders a PER-TENANT COLLECTION (\`${hit.key}\`) into the document. The document ` +
        `request carries no credential — the operator's token lives in localStorage — so the ` +
        `portfolio's operating state ships to anyone with the URL. Make the page a client ` +
        `component and fetch the data from a route behind requireAdmin() with the ` +
        `\`omni_token\` bearer (the idiom \`/api/dashboard/council\` already uses).`,
    });
  }
  return findings;
}

/**
 * Rule 4 — a route with NO credential check whose RESPONSE is a
 * per-tenant collection.
 *
 * THE COLLECTION IS TRACED THROUGH THE RETURNED VALUE, NOT THROUGH THE
 * IMPORT GRAPH.
 *
 * The first version of this rule asked a different question: "can this
 * route reach a module that declares a tenant collection?" It produced
 * twelve findings, and not one of them was a leak — an ingestion route
 * that returns `{ ok, persisted }` reached a portfolio module and was
 * reported for it; six payment routes reached a MEMBERSHIP-TIER table
 * whose `slug` is a tier, not a tenant. A gate that cries wolf gets
 * ignored, and a gate that reports twelve false positives a week is
 * ignored.
 *
 * The question that finds the real defect is narrower and honest: "does
 * the value this route RETURNS carry a per-tenant collection?" So the
 * rule follows the returned expression — through `NextResponse.json(x)`,
 * through the imported function that builds `x`, through the object
 * literal that function returns, through the array it maps — and reports
 * only if it lands on an array of portfolio clients.
 *
 * That is exactly the shape of the control plane that shipped:
 *
 *   return NextResponse.json(buildOmniOSSnapshot());
 *            └─ lib/omni-os/snapshot.ts ─→ CLIENT_AGENT_REGISTRY.map(…)
 *                                             └─ nine clients, their gaps,
 *                                                their next action
 */
export function findUnauthenticatedTenantCollections(src, file, root, derived) {
  const findings = [];
  const rel = relative(root, file);
  if (ignored(src)) return findings;

  const code = stripComments(src);
  if (hasCredentialCheck(code, derived)) return findings;

  const returned = handlerReturnExpressions(src, rel);
  if (!returned.length) return findings;

  const ctx = { root, modules: new Map(), visited: new Set(), derived };
  let hit = null;
  for (const expr of returned) {
    hit = traceCollection(expr, loadModule(file, ctx), ctx, 0);
    if (hit) break;
  }
  if (!hit) return findings;

  findings.push({
    rule: "unauthenticated-tenant-collection",
    file: rel,
    line: hit.line,
    detail:
      `\`${rel}\` has NO credential check (no requireAdmin(), no authorizeCronOrAdmin(), ` +
      `no session read) and RETURNS A PER-TENANT COLLECTION` +
      (hit.file ? ` (declared in \`${hit.file}\`).` : ".") +
      ` An anonymous caller reads the portfolio's book of business — every client, its ` +
      `state, its gaps, its next action. Gate the route with requireAdmin() and serve it ` +
      `\`private, no-store\`.`,
  });
  return findings;
}

// ---------------------------------------------------------------------------
// The return-value tracer
// ---------------------------------------------------------------------------

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/**
 * The expressions a route's HTTP handler RETURNS.
 *
 * Only the exported handlers count. A helper elsewhere in the file that
 * returns a collection is not the route's response — following it would
 * be the same over-approximation the first version of this rule made.
 */
export function handlerReturnExpressions(src, fileName = "route.ts") {
  const source = parseSource(src, fileName);
  const exprs = [];

  const collectReturns = (fn) => {
    const walk = (node) => {
      if (ts.isReturnStatement(node) && node.expression) exprs.push(node.expression);
      ts.forEachChild(node, walk);
    };
    if (fn.body) ts.forEachChild(fn.body, walk);
  };

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && HTTP_METHODS.has(node.name.text)) {
      collectReturns(node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      HTTP_METHODS.has(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      collectReturns(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return exprs;
}

/** Resolve an import specifier to a file in this repo. */
function resolveModulePath(spec, fromFile, root) {
  const dir = fromFile.split("/").slice(0, -1);
  let base = null;
  if (spec.startsWith("@/lib/")) base = join(root, "lib", spec.slice("@/lib/".length));
  else if (spec.startsWith("@/")) base = join(root, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dir.join("/"), spec);
  if (!base) return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/**
 * A module, indexed: what it imports, what it declares, and in WHICH
 * SCOPE it declares it.
 *
 * The index is built once per file and cached for the run.
 *
 * EVERY declaration in the file is indexed, not only the top-level ones,
 * and each one is indexed under the scope that encloses it.
 *
 * WHY SCOPE MATTERS. Two versions of this index failed, both on the
 * same route:
 *
 *   1. Top-level statements only. `CLIENT_AGENT_REGISTRY.map(…)` is
 *      assigned to a `const` INSIDE a function body, so the name
 *      `businesses` was not in the index, the walk gave up one step from
 *      the registry, and the route that shipped the control plane read
 *      as clean.
 *   2. Every declaration, in one flat map. `buildOmniOSSnapshot` and
 *      `buildOmniOSOperatorSnapshot` both declare a `businesses`, and
 *      the flat map kept only the LAST one — the operator projection's,
 *      which maps over a snapshot rather than over the registry. The
 *      walk followed the wrong `businesses` and stopped.
 *
 * A name means different things in different scopes, so the index has to
 * keep them apart.
 */
function loadModule(path, ctx) {
  const cached = ctx.modules.get(path);
  if (cached) return cached;

  const src = readFileSync(path, "utf8");
  const source = parseSource(src, path);
  const imports = new Map();
  const moduleScope = new Map();

  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const target = resolveModulePath(stmt.moduleSpecifier.text, path, ctx.root);
      if (!target) continue;
      const clause = stmt.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const spec of clause.namedBindings.elements) {
          imports.set(spec.name.text, target);
        }
      }
      if (clause?.name) imports.set(clause.name.text, target);
    }
  }

  /** scope id → declarations in that scope. */
  const scopes = new Map();
  /** function node → its own scope id. */
  const scopeOfFunction = new WeakMap();
  /** node → the scope id that encloses it. */
  const enclosingScope = new WeakMap();
  let nextScopeId = 1;

  const isFunctionLike = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node);

  const visit = (node, scopeId) => {
    let currentScope = scopeId;

    if (isFunctionLike(node)) {
      currentScope = nextScopeId++;
      scopes.set(currentScope, new Map());
      scopeOfFunction.set(node, currentScope);
    }
    enclosingScope.set(node, currentScope);

    if (ts.isVariableStatement(node)) {
      const scope = scopes.get(currentScope) || moduleScope;
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const isFunction =
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
        scope.set(d.name.text, {
          kind: isFunction ? "function" : "const",
          node: d,
          scope: currentScope,
        });
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const scope = scopes.get(scopeId) || moduleScope;
      scope.set(node.name.text, { kind: "function", node, scope: scopeId });
    }

    ts.forEachChild(node, (child) => visit(child, currentScope));
  };
  visit(source, 0);

  const mod = {
    path,
    src,
    source,
    imports,
    moduleScope,
    scopes,
    scopeOfFunction,
    enclosingScope,
  };
  ctx.modules.set(path, mod);
  return mod;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isAwaitExpression(current) ||
      ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The return expressions of a function declaration.
 *
 * The walk does NOT descend into a NESTED function: a callback's return
 * is the callback's value, not the outer function's response, and
 * following it sent the walk off into the per-tenant entry objects
 * instead of the collection.
 */
function returnsOf(fnNode) {
  const out = [];
  const walk = (node) => {
    if (ts.isReturnStatement(node) && node.expression) out.push(node.expression);
    ts.forEachChild(node, (child) => {
      if (
        ts.isFunctionDeclaration(child) ||
        ts.isFunctionExpression(child) ||
        ts.isArrowFunction(child)
      ) {
        return;
      }
      walk(child);
    });
  };
  if (fnNode.body) ts.forEachChild(fnNode.body, walk);
  return out;
}

/**
 * The return expressions of a declaration, whether it is a function
 * declaration or a `const` holding an arrow function.
 */
function declarationReturns(decl) {
  if (decl.kind !== "function") return [];
  if (ts.isFunctionDeclaration(decl.node)) return returnsOf(decl.node);
  const init = decl.node.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return returnsOf(init);
  return [];
}

/**
 * The scope a function's BODY lives in.
 *
 * This is not the scope the function is DECLARED in — it is the scope
 * the names inside its body belong to. A builder that declares
 * `const businesses = …` inside its body and returns it is only
 * resolvable from inside that body.
 */
function bodyScopeOf(mod, decl) {
  if (!decl) return 0;
  const node = ts.isFunctionDeclaration(decl.node) ? decl.node : decl.node.initializer;
  if (!node) return decl.scope ?? 0;
  return mod.scopeOfFunction.get(node) ?? decl.scope ?? 0;
}

/**
 * Follow an expression to the data it carries.
 *
 * Returns `{ file, line }` when the expression reaches an array of
 * portfolio clients, and null otherwise. The walk is bounded by depth
 * and by a visited set — the graph of a route's own code is small, but
 * a recursive builder would otherwise loop.
 *
 * The depth budget is 12 because the real shape is long: route → the
 * builder it calls → the object it returns → the array it maps → the
 * registry it maps. A budget of 6 stopped the walk one step short of
 * the registry, which is the difference between finding the control
 * plane and missing it.
 *
 * `scope` is the id of the scope the expression sits in — it decides
 * which `businesses` a name refers to.
 */
function traceCollection(expr, mod, ctx, depth, scope = 0) {
  if (!expr || depth > 12) return null;
  const node = unwrapExpression(expr);
  if (!node) return null;

  if (ts.isArrayLiteralExpression(node)) {
    const hit = portfolioArrayHit(node, mod.source);
    return hit ? { file: relative(ctx.root, mod.path), line: hit.line } : null;
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const hit = traceCollection(prop.initializer, mod, ctx, depth + 1, scope);
        if (hit) return hit;
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const hit = traceName(prop.name.text, mod, ctx, depth + 1, scope);
        if (hit) return hit;
      } else if (ts.isSpreadAssignment(prop)) {
        const hit = traceCollection(prop.expression, mod, ctx, depth + 1, scope);
        if (hit) return hit;
      }
    }
    return null;
  }

  if (ts.isCallExpression(node)) {
    // The arguments come first: `NextResponse.json(value)`.
    for (const arg of node.arguments) {
      const hit = traceCollection(arg, mod, ctx, depth + 1, scope);
      if (hit) return hit;
    }
    const callee = node.expression;
    if (ts.isIdentifier(callee)) return traceName(callee.text, mod, ctx, depth + 1, scope);
    if (ts.isPropertyAccessExpression(callee)) {
      return traceCollection(callee.expression, mod, ctx, depth + 1, scope);
    }
    if (ts.isElementAccessExpression(callee)) {
      return traceCollection(callee.expression, mod, ctx, depth + 1, scope);
    }
    return null;
  }

  if (ts.isPropertyAccessExpression(node)) {
    return traceCollection(node.expression, mod, ctx, depth + 1, scope);
  }

  if (ts.isIdentifier(node)) {
    return traceName(node.text, mod, ctx, depth + 1, scope);
  }

  if (ts.isConditionalExpression(node)) {
    return (
      traceCollection(node.whenTrue, mod, ctx, depth + 1, scope) ||
      traceCollection(node.whenFalse, mod, ctx, depth + 1, scope)
    );
  }

  return null;
}

/**
 * Follow a NAME to the data it holds.
 *
 * A local declaration is followed in place, in ITS OWN SCOPE; an
 * imported one is followed into the module that declares it. If the
 * module it lands in proves a credential of its own, the walk STOPS — a
 * route whose response is built by an authenticating helper is not an
 * anonymous route.
 */
function traceName(name, mod, ctx, depth, scope = 0) {
  const key = `${mod.path}#${scope}#${name}`;
  if (ctx.visited.has(key)) return null;
  ctx.visited.add(key);

  const local = (mod.scopes.get(scope) || mod.moduleScope).get(name);
  const decl = local || mod.moduleScope.get(name);
  if (decl) {
    if (decl.kind === "const") {
      return traceCollection(decl.node.initializer, mod, ctx, depth + 1, decl.scope ?? scope);
    }
    const bodyScope = bodyScopeOf(mod, decl);
    for (const ret of declarationReturns(decl)) {
      const hit = traceCollection(ret, mod, ctx, depth + 1, bodyScope);
      if (hit) return hit;
    }
    return null;
  }

  const imported = mod.imports.get(name);
  if (!imported) return null;

  const target = loadModule(imported, ctx);
  if (hasCredentialCheck(stripComments(target.src), ctx.derived)) return null;

  const tdecl = target.moduleScope.get(name);
  if (!tdecl) return null;
  if (tdecl.kind === "const") {
    return traceCollection(tdecl.node.initializer, target, ctx, depth + 1, tdecl.scope ?? 0);
  }
  const targetBodyScope = bodyScopeOf(target, tdecl);
  for (const ret of declarationReturns(tdecl)) {
    const hit = traceCollection(ret, target, ctx, depth + 1, targetBodyScope);
    if (hit) return hit;
  }
  return null;
}

/** Is this array literal a collection of portfolio clients? */
function portfolioArrayHit(node, source) {
  const entries = node.elements.filter(ts.isObjectLiteralExpression);
  if (!entries.length) return null;
  for (const entry of entries) {
    const keys = entry.properties
      .map((p) =>
        ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) ? propertyName(p.name) : null,
      )
      .filter(Boolean);
    if (isPortfolioEntry(keys)) {
      const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
      return { line: pos.line + 1 };
    }
  }
  return null;
}

/**
 * Scan one file against every rule that applies to it.
 *
 * A page is judged by the two page rules; a route by the two route rules.
 * `derived` is the set of credential verifiers derived from lib/ — without
 * it the route rules cannot tell a real check from a comment.
 */
export function scanFile(path, root, prefixes, derived = new Set()) {
  const src = readFileSync(path, "utf8");
  if (ignored(src)) return [];
  const isPage = /page\.tsx$/.test(path);
  const findings = isPage
    ? [
        ...findInternalPageReads(src, path, root, prefixes),
        ...findInternalPageTenantCollections(src, path, root, prefixes),
      ]
    : [
        ...findUnauthenticatedTenantMetrics(src, path, root, derived),
        ...findUnauthenticatedTenantCollections(src, path, root, derived),
      ];
  return findings;
}

function main() {
  const { reportOnly, root, files } = parseArgs(process.argv.slice(2));
  const prefixes = internalPrefixes(root);

  const explicit = files.length > 0;
  const pages = explicit ? files.filter((f) => /page\.tsx$/.test(f)) : collectPages(root);
  const routes = explicit ? files.filter((f) => /route\.ts$/.test(f)) : collectRoutes(root);

  let derived;
  try {
    derived = deriveCredentialVerifiers(root);
  } catch (error) {
    console.error(
      `[internal-surface] the credential verifiers could not be derived ` +
        `(${error && error.message}) — the routes cannot be judged. The result is UNKNOWN. ` +
        `This gate did not run.`,
    );
    return 2;
  }

  const findings = [];

  for (const page of pages) {
    findings.push(...scanFile(page, root, prefixes, derived));
  }
  for (const route of routes) {
    findings.push(...scanFile(route, root, prefixes, derived));
  }

  const rules = [
    "internal-page-privileged-read",
    "internal-page-tenant-collection",
    "unauthenticated-tenant-metrics",
    "unauthenticated-tenant-collection",
  ];

  if (!findings.length) {
    console.log(
      `[internal-surface] ${rules.length} rule(s) ran — ` +
        `internal-page-privileged-read + internal-page-tenant-collection over ` +
        `${pages.length} page(s) (${prefixes.length} internal prefix(es) from app/robots.ts), ` +
        `unauthenticated-tenant-metrics + unauthenticated-tenant-collection over ` +
        `${routes.length} route(s), with ${derived.size} credential verifier(s) derived from lib/ — ` +
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
