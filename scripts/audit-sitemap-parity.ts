#!/usr/bin/env node
/**
 * Sitemap-parity gate: the sitemap and the routes' indexability must agree.
 *
 * Why this exists
 *
 * The sitemap is the site's discovery manifest — it is the list of URLs the
 * site asks a crawler to index. A route's `robots` metadata is the site's
 * answer to the same question, per page. When the two disagree, one of them
 * is lying, and which one lies decides whether the page is findable:
 *
 *   - A sitemap URL whose page renders `noindex` is a contradiction. The
 *     manifest says "index this"; the page says "do not". The page wins —
 *     the URL never enters the index, and the sitemap entry is dead weight.
 *   - An indexable route the sitemap does not name is a page that asks to
 *     be indexed and is never offered. Crawlers can still find it by
 *     following links, but the sitemap is what a crawler reads to decide
 *     what a site is *about*.
 *
 * Both halves were true of this site at the same time, and for six months:
 *
 *   /sponsor/info          in the sitemap, rendered `noindex, nofollow`
 *   /sponsor/application   in the sitemap, rendered `noindex, nofollow`
 *   13 indexable pages    absent from the sitemap
 *
 * The two sponsor pages are the interesting half. app/sponsor/layout.tsx
 * declares `robots: { index: false, follow: false }` because /sponsor
 * itself is a logged-in portal — correct. But Next.js merges metadata down
 * the layout chain, and the directive is inherited by every route in the
 * /sponsor subtree. The two public sponsor pages declared no robots of
 * their own, so they inherited the portal's noindex: the sponsor program —
 * the site's only sponsorship conversion path — had been de-indexed since
 * 2026-04-23 while the sitemap kept advertising it. The commit that
 * introduced the noindex (bc87f11d) states the opposite intent in its own
 * message: "keep /sponsor/info at priority 0.5 as the canonical public
 * marketing page". The intent was right; the implementation was one level
 * too broad.
 *
 * Nothing in the toolchain could see it. `tsc` cannot see it (the metadata
 * is valid). `next build` cannot see it (the merge is correct Next.js
 * behaviour). The RLS, cron-auth and public-PII gates cannot see it (it is
 * not an access-control question). The live mobile gate cannot see it (it
 * measures overflow, images, links and theme — not indexability). And the
 * sitemap is not a route, so the route-structure gate never reads it.
 *
 * The general form: **a contract between two artifacts is only enforced if
 * something compares them.** The sitemap and the routes are two artifacts
 * that both answer "what should be indexed?", and nothing compared them.
 *
 * What this gate checks (statically, from source)
 *
 *   sitemap-url-noindex            a URL the sitemap advertises whose route
 *                                  resolves to `noindex`
 *   indexable-route-not-in-sitemap a route that asks to be indexed and the
 *                                  sitemap does not carry
 *   sitemap-url-without-route      a URL the sitemap advertises that no
 *                                  route serves
 *   sitemap-url-disallowed         a URL the sitemap advertises that
 *                                  app/robots.ts disallows — a crawler is
 *                                  never allowed to fetch it
 *   robots-bare-path-crawlable     the index of a blocked subtree that the
 *                                  block does not cover — "Disallow: /admin/"
 *                                  blocks "/admin/info" but NOT "/admin"
 *
 * The three artifacts
 *
 * Three files on this site answer "should this URL be indexed?", and all
 * three are maintained by hand:
 *
 *   app/sitemap.ts    the URLs the site asks a crawler to index
 *   app/robots.ts     the URLs a crawler is not allowed to fetch at all
 *   the route metadata  the per-page answer, which the sitemap and
 *                       robots.ts are both supposed to agree with
 *
 * A URL that robots.txt disallows is a URL the crawler never even
 * requests, so advertising it in the sitemap is a dead entry — the same
 * class of defect as a sitemap URL that 404s, and just as invisible to
 * every other gate here.
 *
 * How the effective robots directive is computed
 *
 * Next.js accumulates metadata from the root layout down to the page, and
 * each level REPLACES the `robots` field of the one above it — it is not
 * merged key by key. So the effective directive for a route is the robots
 * declared by the deepest source that declares one, where the sources are:
 *
 *   app/layout.tsx, app/<seg>/layout.tsx, …, app/<seg>/page.tsx
 *
 * `noindex: true` is also accepted, because `buildMetadata()` in
 * lib/seo.ts turns that option into `robots: { index: false }`. Sources
 * are read with their comments stripped, so a directive named in prose does
 * not count as a directive.
 *
 * Scope: STATIC routes only. A route with a dynamic segment
 * (`app/[slug]/page.tsx`, `app/newsletter/[slug]/page.tsx`) is served from
 * the database and advertised from the database, so the sitemap's dynamic
 * sections cannot be compared to the filesystem at all. The live
 * counterpart — `node scripts/audit-live-mobile.mjs --all` — measures the
 * rendered truth for those URLs, including whether they are noindex.
 *
 * Usage: npx tsx scripts/audit-sitemap-parity.ts
 * Exit:  0 no findings, 1 findings, 2 the app directory is unreadable
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(process.cwd());
const APP_DIR = path.join(ROOT, "app");
const SITEMAP_FILE = path.join(APP_DIR, "sitemap.ts");

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-prod", ".turbo", ".git", "dist", "coverage"]);

type Robots = "index" | "noindex" | "unknown";

type Finding = {
  rule: string;
  file: string;
  detail: string;
};

const findings: Finding[] = [];

/** Every file under a directory, skipping build output and VCS metadata. */
function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".well-known") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Strip comments so a directive named in prose is not read as a directive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The robots directive a metadata source declares, or "unknown" if it
 * declares none. A source that declares nothing inherits from the level
 * above it.
 */
function robotsOf(src: string): Robots {
  const code = stripComments(src);

  // The object form: robots: { index: false, … } / { index: true, … }.
  const obj = code.match(/robots\s*:\s*\{([\s\S]*?)\}/);
  if (obj) {
    const body = obj[1];
    if (/index\s*:\s*false/.test(body)) return "noindex";
    if (/index\s*:\s*true/.test(body)) return "index";
  }

  // The string form: robots: "noindex".
  const str = code.match(/robots\s*:\s*["'`]([^"'`]+)["'`]/);
  if (str) return /noindex/i.test(str[1]) ? "noindex" : "index";

  // buildMetadata({ … noindex: true … }) — lib/seo.ts turns this into
  // robots: { index: false }.
  if (/\bnoindex\s*:\s*true\b/.test(code)) return "noindex";
  if (/\bnoindex\s*:\s*false\b/.test(code)) return "index";

  return "unknown";
}

/** The URL a route directory serves, with route groups removed. */
function routePath(dir: string): string {
  const rel = path.relative(APP_DIR, dir);
  if (!rel) return "/";
  const segs = rel
    .split(path.sep)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

/** True when any segment of the route is dynamic. */
function isDynamic(dir: string): boolean {
  return path
    .relative(APP_DIR, dir)
    .split(path.sep)
    .some((s) => s.startsWith("["));
}

if (!fs.existsSync(APP_DIR) || !fs.existsSync(SITEMAP_FILE)) {
  console.error("[sitemap-parity] app/ or app/sitemap.ts is unreadable — the result is UNKNOWN.");
  process.exit(2);
}

/* ── The routes ─────────────────────────────────────────────────────────── */

type Route = { url: string; dir: string; robots: Robots; source: string };

const routes: Route[] = [];
const allFiles = walk(APP_DIR);

for (const file of allFiles) {
  if (path.basename(file) !== "page.tsx") continue;
  const dir = path.dirname(file);
  if (isDynamic(dir)) continue;

  // The metadata chain: every layout from the app root down to this page's
  // own directory, then the page itself. Deepest declaration wins.
  const chain: string[] = [];
  const rel = path.relative(APP_DIR, dir);
  const parts = rel ? rel.split(path.sep) : [];
  let acc = APP_DIR;
  const layout = path.join(acc, "layout.tsx");
  if (fs.existsSync(layout)) chain.push(layout);
  for (const seg of parts) {
    acc = path.join(acc, seg);
    const l = path.join(acc, "layout.tsx");
    if (fs.existsSync(l)) chain.push(l);
  }
  chain.push(file);

  let robots: Robots = "unknown";
  let source = "";
  for (const src of chain) {
    let text: string;
    try {
      text = fs.readFileSync(src, "utf8");
    } catch {
      continue;
    }
    const r = robotsOf(text);
    if (r !== "unknown") {
      robots = r;
      source = path.relative(ROOT, src);
    }
  }

  routes.push({ url: routePath(dir), dir, robots, source });
}

/* ── The advertised URLs ─────────────────────────────────────────────────── */

const sitemapSrc = stripComments(fs.readFileSync(SITEMAP_FILE, "utf8"));

// The literal `${baseUrl}/path` entries of the static list. A path that
// interpolates a row (`${r.slug}`) is dynamic and is not compared here.
const advertised = new Set<string>();
for (const m of sitemapSrc.matchAll(/\$\{baseUrl\}([^`"'\s]*)/g)) {
  const p = m[1];
  if (!p || p.includes("${")) continue;
  advertised.add(p === "" ? "/" : p);
}
// The root is advertised as the bare `baseUrl` rather than a template.
if (/\burl\s*:\s*baseUrl\b/.test(sitemapSrc)) advertised.add("/");

// The paths app/robots.ts disallows. A disallowed path is one a crawler is
// never allowed to request, so advertising it in the sitemap is a dead
// entry. robots.txt uses prefix matching, so "/api/" covers every URL
// under it.
const disallowed: string[] = [];
const robotsFile = path.join(APP_DIR, "robots.ts");
if (fs.existsSync(robotsFile)) {
  const robotsSrc = stripComments(fs.readFileSync(robotsFile, "utf8"));
  const list = robotsSrc.match(/disallow\s*:\s*\[([\s\S]*?)\]/);
  if (list) {
    for (const m of list[1].matchAll(/["'`]([^"'`]*)["'`]/g)) {
      const p = m[1].trim();
      if (p) disallowed.push(p);
    }
  }
}

/* ── The rules ──────────────────────────────────────────────────────────── */

const routeByUrl = new Map(routes.map((r) => [r.url, r]));

/** Uncovered subtree indexes already reported — index URL + the rule that blocks its children. */
const uncoveredIndexes = new Map<string, string>();

/** Bare paths already reported as crawlable, so the two shapes do not double-report. */
const reportedIndexes = new Set<string>();

for (const url of [...advertised].sort()) {
  const route = routeByUrl.get(url);
  if (!route) {
    // A URL the sitemap advertises that no static route serves. Dynamic
    // families are advertised from the database and are not in this set.
    findings.push({
      rule: "sitemap-url-without-route",
      file: path.relative(ROOT, SITEMAP_FILE),
      detail:
        `the sitemap advertises "${url}" but no static route serves it. ` +
        "Either the route was removed and the sitemap entry was not, or the URL is a typo.",
    });
    continue;
  }
  if (route.robots === "noindex") {
    findings.push({
      rule: "sitemap-url-noindex",
      file: path.relative(ROOT, route.source),
      detail:
        `the sitemap advertises "${url}" but the route renders ` +
        "`noindex, nofollow` — the manifest says \"index this\" and the page says " +
        "\"do not\". The page wins, so this URL never enters the index. Either " +
        "declare `robots: { index: true, follow: true }` on the route (a page-level " +
        "declaration replaces the inherited one), or remove the URL from the sitemap.",
    });
  }
}

for (const url of [...advertised].sort()) {
  const blocked = disallowed.find((d) => url === d || url.startsWith(d));
  if (!blocked) continue;
  findings.push({
    rule: "sitemap-url-disallowed",
    file: path.relative(ROOT, robotsFile),
    detail:
      `the sitemap advertises "${url}" but app/robots.ts disallows "${blocked}". A ` +
      "disallowed path is never fetched by a compliant crawler, so this entry can never " +
      "be crawled — it is a dead entry in the discovery manifest.",
  });
}

/**
 * The index of a blocked subtree must be blocked with it.
 *
 * robots.txt matches by PREFIX, so "Disallow: /admin/" covers every
 * sub-route ("/admin/info") but NOT "/admin" itself — the bare URL, which
 * is the one a probing bot tries first. The sub-tree's own pages render
 * noindex, so the page itself never enters the index either way; what
 * leaks is the fact that the surface EXISTS at that URL, which is exactly
 * what the disallow list says it is there to prevent.
 *
 * Two shapes are checked:
 *
 *   1. A trailing-slash disallow whose bare path is a route ("/admin/"
 *      while "/admin" exists). The index is crawlable.
 *   2. A blocked route whose ancestor route is not covered — the same
 *      leak, seen from the child.
 */
for (const d of disallowed) {
  if (!d.endsWith("/")) continue;
  const bare = d.slice(0, -1);
  if (!bare || !routeByUrl.has(bare)) continue;
  if (disallowed.some((other) => other !== d && (bare === other || bare.startsWith(other)))) continue;

  findings.push({
    rule: "robots-bare-path-crawlable",
    file: path.relative(ROOT, robotsFile),
    detail:
      `app/robots.ts disallows "${d}", which covers the sub-routes of "${bare}", but ` +
      `not "${bare}" itself. robots.txt matches by prefix, so a trailing slash blocks ` +
      `the sub-routes and leaves the bare path crawlable — and the bare path is the one ` +
      `a bot probes first. Disallow "${bare}" instead of (or as well as) "${d}".`,
  });
  reportedIndexes.add(bare);
}

for (const route of routes) {
  const blockedBy = disallowed.find((d) => route.url === d || route.url.startsWith(d));
  if (!blockedBy) continue;

  // The longest route URL that is a proper ancestor of this one — the
  // index of the subtree the route belongs to.
  let index: Route | undefined;
  for (const candidate of routes) {
    if (candidate.url === route.url) continue;
    if (!route.url.startsWith(candidate.url + "/")) continue;
    if (!index || candidate.url.length > index.url.length) index = candidate;
  }
  if (!index) continue;
  if (reportedIndexes.has(index.url)) continue;

  const indexCovered = disallowed.find((d) => index.url === d || index.url.startsWith(d));
  if (indexCovered) continue;

  // One finding per uncovered index, not one per sub-route: the defect is
  // the index path, and 25 findings for 25 dashboard pages would bury it.
  const key = `${index.url}|${blockedBy}`;
  if (uncoveredIndexes.has(key)) continue;
  uncoveredIndexes.set(key, route.url);

  findings.push({
    rule: "robots-bare-path-crawlable",
    file: path.relative(ROOT, robotsFile),
    detail:
      `app/robots.ts disallows "${blockedBy}", which covers "${route.url}", but the ` +
      `index of that subtree — "${index.url}" — is not disallowed. robots.txt matches ` +
      "by prefix, so a trailing slash blocks the sub-routes and leaves the bare path " +
      `crawlable, and the bare path is the one a bot probes first. Disallow "${index.url}" ` +
      "instead of (or as well as) the trailing-slash form.",
  });
}

for (const route of routes.sort((a, b) => a.url.localeCompare(b.url))) {
  if (route.robots !== "index") continue;
  if (advertised.has(route.url)) continue;
  findings.push({
    rule: "indexable-route-not-in-sitemap",
    file: path.relative(ROOT, route.source),
    detail:
      `"${route.url}" declares indexable but the sitemap does not carry it. A page that ` +
      "asks to be indexed and is never offered in the discovery manifest is only " +
      "reachable by accident. Add it to app/sitemap.ts, or make the page noindex if it " +
      "is genuinely not meant to be indexed.",
  });
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const byRule: Record<string, number> = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;

console.log(
  `\n[sitemap-parity] ${routes.length} static route(s), ${advertised.size} advertised URL(s) — ` +
    `${findings.length} finding(s) across ${Object.keys(byRule).length} rule(s)`,
);
for (const f of findings) {
  console.log(`\n  ${f.rule}  ${f.file}`);
  console.log(`    ${f.detail}`);
}
if (findings.length > 0) process.exit(1);
