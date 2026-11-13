#!/usr/bin/env node
/**
 * Route-probe gate: every public route that can 404 must have a live probe.
 *
 * Why this exists
 *
 * `scripts/audit-live-mobile.mjs` is the only instrument in this repo that can
 * prove a route still answers a REAL 404 rather than a 200 soft-404. It does
 * that with `NOT_FOUND_PROBES`: a list of URLs that cannot exist, each of
 * which must answer 404. That list is what caught the session-57 regression —
 * five public 404s had become 200 soft-404s and every probe fired.
 *
 * But the list is maintained BY HAND, and a hand-maintained list cannot know
 * it has gone stale. Item 12 of this repo's memory says to add a probe when a
 * route is created — a sentence in a file, which is exactly the kind of
 * control this repo has learned does not hold (the same sentence was read
 * before the regression shipped anyway).
 *
 * So the coverage is derived instead of remembered. This gate enumerates the
 * app's dynamic routes, works out which ones can 404, and checks each against
 * the probe list. A route added next month with no probe is a finding, at
 * build time, rather than a soft-404 discovered by a crawler.
 *
 * How a route is judged 404-capable
 *
 *   - the page calls `notFound()`, or
 *   - the segment sets `dynamicParams = false` (Next.js then 404s unknown
 *     params on its own, with no notFound() in the file).
 *
 * A route that does neither cannot 404, so it needs no probe — e.g.
 * `app/command/client/[slug]` is a client component that renders "Admin
 * only" or "Client not found." as a state, at 200, by design. Demanding a
 * probe of it would be a gate crying wolf.
 *
 * How a probe is matched to a route
 *
 * By SHAPE, not by an exact string, because the probes carry real segments
 * where the route carries a parameter: `/p/omnileads/zzzz-not-a-real-page`
 * is the probe for `/p/[business]/[slug]`, and
 * `/book/00000000-0000-0000-0000-000000000000` is the probe for
 * `/book/[business]`. A probe matches a route when it has the same number of
 * segments AND every literal segment of the route appears at the same index
 * in the probe.
 *
 * Usage: npx tsx scripts/audit-route-probes.ts
 * Exit:  0 no findings, 1 findings, 2 the app directory or the probe list is unreadable
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(process.cwd());
const APP_DIR = path.join(ROOT, "app");
const LIVE_AUDIT = path.join(ROOT, "scripts", "audit-live-mobile.mjs");

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-prod", ".turbo", ".git", "dist", "coverage"]);

/**
 * The rules this gate runs.
 *
 * A gate that reports only what it FOUND cannot be told apart from a gate
 * that found nothing because it did not look. Naming the rules, and
 * reporting how many ran, makes the difference visible in the build log:
 * "1 rule ran over 21 routes" says the instrument was pointed at
 * something; silence says nothing at all.
 */
const RULE_NAMES = ["404-capable-route-without-live-probe"];

type Route = {
  /** The route as it appears in the URL: /newsletter/[slug] */
  routePath: string;
  /** The literal segments with their index, e.g. [{ index: 0, value: "newsletter" }] */
  literals: { index: number; value: string }[];
  /** How many segments the route has. */
  depth: number;
  /** The file the route was read from. */
  file: string;
  /** Why this route can 404. */
  reason: string;
};

/** Walk the app directory for dynamic segment directories. */
function findDynamicRoutes(dir: string, segments: string[] = []): Route[] {
  const routes: Route[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return routes;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(dir, entry.name);
    // `app/api/**` is not a public route — its responses are JSON and are
    // covered by the auth and PII gates, not by a 404 probe.
    if (segments.length === 0 && entry.name === "api") continue;
    const isDynamic = entry.name.startsWith("[") && entry.name.endsWith("]");
    // The dynamic segment still counts toward the route's shape — it is a
    // segment in the URL — but it is not a LITERAL, so it is excluded from
    // the literal list and the probe may put anything there.
    const next = [...segments, entry.name];
    if (isDynamic) {
      const pageFile = path.join(child, "page.tsx");
      if (fs.existsSync(pageFile)) {
        const route = classify(child, pageFile, next);
        if (route) routes.push(route);
      }
    }
    routes.push(...findDynamicRoutes(child, next));
  }
  return routes;
}

/** Decide whether a dynamic route can answer a 404, and how. */
function classify(dir: string, file: string, segments: string[]): Route | null {
  let source: string;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const reason = source.includes("notFound(")
    ? "the page calls notFound()"
    : /dynamicParams\s*=\s*false/.test(source)
      ? "the segment sets dynamicParams = false, so unknown params 404 on their own"
      : null;
  if (!reason) return null;

  const literals: { index: number; value: string }[] = [];
  segments.forEach((segment, index) => {
    if (!segment.startsWith("[")) literals.push({ index, value: segment });
  });
  return {
    routePath: `/${segments.join("/")}`,
    literals,
    depth: segments.length,
    file: path.relative(ROOT, file),
    reason,
  };
}

/** Read the live audit's NOT_FOUND_PROBES list. */
function readProbes(): string[] {
  let source: string;
  try {
    source = fs.readFileSync(LIVE_AUDIT, "utf8");
  } catch {
    console.error("[route-probes] could not read scripts/audit-live-mobile.mjs — the result is UNKNOWN.");
    process.exit(2);
  }
  const match = /const NOT_FOUND_PROBES\s*=\s*\[([\s\S]*?)\]/.exec(source);
  if (!match) {
    console.error("[route-probes] NOT_FOUND_PROBES could not be found in scripts/audit-live-mobile.mjs.");
    console.error("[route-probes] the result is UNKNOWN — the probe list may have been renamed or removed.");
    process.exit(2);
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Does a probe have the same shape as the route? */
function probeMatches(probe: string, route: Route): boolean {
  const parts = probe.split("/").filter(Boolean);
  if (parts.length !== route.depth) return false;
  return route.literals.every(({ index, value }) => parts[index] === value);
}

function main(): number {
  if (!fs.existsSync(APP_DIR)) {
    console.error("[route-probes] the app directory does not exist — the result is UNKNOWN.");
    return 2;
  }
  const routes = findDynamicRoutes(APP_DIR);
  const probes = readProbes();

  const findings: { route: Route }[] = [];
  for (const route of routes) {
    if (!probes.some((probe) => probeMatches(probe, route))) findings.push({ route });
  }

  console.log(`[route-probes] ${RULE_NAMES.length} rule(s) ran over ${routes.length} public route(s) that can answer a 404; ${probes.length} live probe(s) in the list.`);
  for (const route of routes) {
    const covered = probes.some((probe) => probeMatches(probe, route));
    console.log(`  ${covered ? "ok  " : "MISS"} ${route.routePath} — ${route.reason}`);
  }

  if (findings.length) {
    console.log("");
    for (const { route } of findings) {
      console.log(`[route-probes] ${route.routePath} can 404 but no live probe covers it (${route.file})`);
      console.log(`[route-probes]   a probe proves this route answers a REAL 404 rather than a 200 soft-404;`);
      console.log(`[route-probes]   add one to NOT_FOUND_PROBES in scripts/audit-live-mobile.mjs, e.g. '${route.routePath.replace(/\[\w+\]/g, "zzzz-not-a-real-page")}'.`);
    }
    console.log(`[route-probes] ${findings.length} finding(s): a 404-capable route with no probe is invisible to the live audit.`);
    return 1;
  }
  console.log(`[route-probes] ${RULE_NAMES.length} rule(s) ran — no findings: every public route that can 404 has a live probe.`);
  return 0;
}

process.exit(main());
