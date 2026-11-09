#!/usr/bin/env node
/**
 * Fleet sweep: does the INTERNAL-SURFACE class exist in the other surfaces?
 *
 * Why this exists
 *
 * On 2026-11-04 this repo's own gates were all green while three internal
 * surfaces served privileged data to anyone with the URL (`/dashboard/council`
 * → 120 KB of the Council Codex, `/dashboard/federation` → 70 KB of the
 * cross-promo funnel, `/api/federation/health` → every client's 30-day
 * lead count and traffic). One week later a third control plane was still
 * open: `/api/omni-os/snapshot` answered an anonymous curl with 47,896
 * bytes of the agency's book of business.
 *
 * The fixes were gates, and the gates were written HERE. The defect class
 * is a SHAPE — a privileged read on a surface the operator marked
 * internal, with no credential on the request — and the shape is written
 * from scratch in every surface that has an operator dashboard. The
 * precedent is the failed-lookup sweep: a gate that cannot see a copy is
 * a gate that has not been applied.
 *
 * THE RULES ARE NOT RE-IMPLEMENTED HERE. This sweep imports the detector
 * from `scripts/audit-internal-surface.mjs` and applies it to every page
 * and route in every fleet checkout, so the fleet answer and the
 * canonical answer can never disagree about what the rule IS. That
 * matters more here than in any other sweep: the collection rule was
 * wrong twice before it was right, and two copies of "right" would be
 * two chances to be wrong again.
 *
 * THE POPULATION IS DERIVED, AND IT HAS THREE PARTS
 *
 * The fleet-auth sweep already established how to ask "what is the
 * fleet?" — once, in `fleet-trees.mjs` and `audit-fleet-auth.mjs` — and
 * the three populations it answers with are reused here rather than
 * re-derived:
 *
 *   1. canonical sites  — a live surface. A finding here is a live leak.
 *   2. linked copies    — a tree carrying a `.vercel` link to a project.
 *      One `vercel --prod` away from shipping. This is where the two
 *      archived copies of this repo were found.
 *   3. unlinked sites   — not deployable today, one `vercel link` away.
 *      A finding here is a defect that becomes a leak the moment someone
 *      links the tree.
 *
 * PER-TREE DERIVATION, NOT A SHARED POPULATION
 *
 * The canonical gate derives its page population from that tree's own
 * `app/robots.ts` (one source of truth for "internal") and its
 * credential verifiers from that tree's own `lib/`. A tree that declares
 * no internal prefixes gets no page population — and this sweep SAYS SO,
 * rather than letting "found nothing" and "looked at nothing" print
 * alike. A tree whose verifiers cannot be derived is UNKNOWN for the
 * route rules, and is reported as such.
 *
 * A TREE IS GRADED BY WHAT IT CAN SHIP, NOT BY WHERE IT SITS
 *
 * The first version of this sweep graded a tree by the DIRECTORY it was
 * found in, and that graded two trees wrongly. `candidateRoots` finds
 * every directory under the fleet root that has an `app/page.tsx`, so an
 * ARCHIVED COPY of this repo was reported as "live surface — a canonical
 * checkout". It is not: it is an archive, and — the part that actually
 * matters — it carries `.vercel/project.json` for the PRODUCTION Vercel
 * project. A `vercel --prod` from that folder ships to omnileadsagi.com.
 *
 * The report therefore never says "this tree is a live surface" on the
 * strength of where it was found. It says what the tree can DEPLOY, and
 * it puts the trees linked to the production project FIRST, because they
 * are the ones where a finding is a leak rather than a curiosity.
 *
 * The production project is DERIVED, never hardcoded: this script lives in
 * the canonical checkout, so the canonical checkout's own `.vercel` link
 * names the project, and its own `lib/seo.ts` names the domain. A copy
 * read by a different repo cannot silently judge the production project
 * by a stale constant.
 *
 * Usage:
 *   node scripts/audit-fleet-internal-surface.mjs             # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-internal-surface.mjs --dir <path>
 *   node scripts/audit-fleet-internal-surface.mjs --report     # always exit 0
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectPages,
  collectRoutes,
  internalPrefixes,
  scanFile,
} from "./audit-internal-surface.mjs";
import { deriveCredentialVerifiers } from "./audit-public-pii.mjs";
import { candidateRoots } from "./fleet-trees.mjs";
import {
  deployableCheckouts,
  looksLikeSite,
  unlinkedSites,
} from "./audit-fleet-auth.mjs";

function parseArgs(argv) {
  const options = {
    reportOnly: false,
    dir: join(homedir(), "Desktop", "Clients"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") options.reportOnly = true;
    else if (a === "--dir") options.dir = resolve(argv[++i]);
  }
  return options;
}

/**
 * The Vercel project a checkout is linked to, with its name.
 *
 * `.vercel/project.json` is what `vercel --prod` reads to decide which
 * project it deploys to. A directory carrying one is a DEPLOYABLE TREE,
 * whatever else it looks like — a canonical checkout, a worktree, or an
 * archive somebody kept for the artwork.
 */
export function vercelLink(dir) {
  try {
    const parsed = JSON.parse(
      readFileSync(join(dir, ".vercel", "project.json"), "utf8"),
    );
    if (typeof parsed.projectId !== "string") return null;
    return {
      projectId: parsed.projectId,
      projectName:
        typeof parsed.projectName === "string" ? parsed.projectName : null,
    };
  } catch {
    return null;
  }
}

/**
 * The canonical checkout this script ships in — the tree whose `.vercel`
 * link names the PRODUCTION project and whose `lib/seo.ts` names the
 * production domain. Derived from this file's own location, so the
 * answer cannot drift from the repo the sweep belongs to.
 */
function canonicalCheckout() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/** The production project + domain, derived from the canonical checkout. */
export function productionProfile() {
  const root = canonicalCheckout();
  const link = vercelLink(root);
  let domain = null;
  try {
    const seo = readFileSync(join(root, "lib", "seo.ts"), "utf8");
    const match = seo.match(/export const SITE_URL\s*=\s*["']([^"']+)["']/);
    if (match) {
      try {
        domain = new URL(match[1]).host;
      } catch {
        domain = match[1];
      }
    }
  } catch {
    domain = null;
  }
  return { root, projectId: link?.projectId ?? null, projectName: link?.projectName ?? null, domain };
}

/**
 * A tree's pages and routes, in both layouts (`app/` and `src/app/`).
 * The canonical collector takes a root and looks under `<root>/app`, so
 * `src/app` is reached by handing it the `src` directory.
 */
function treeFiles(root) {
  const pages = [...collectPages(root), ...collectPages(join(root, "src"))];
  const routes = [...collectRoutes(root), ...collectRoutes(join(root, "src"))];
  return { pages, routes };
}

/** Scan one tree. Returns its findings, or UNKNOWN with a reason. */
function scanTree(root) {
  const prefixes = internalPrefixes(root);
  const { pages, routes } = treeFiles(root);

  // The route rules need to know what a real credential check looks like
  // IN THIS TREE. If they cannot be derived, the route rules did not
  // run, and the tree is UNKNOWN — not clean.
  let derived;
  try {
    derived = deriveCredentialVerifiers(root);
  } catch (error) {
    return {
      prefixes,
      pages: pages.length,
      routes: routes.length,
      unknown: `credential verifiers could not be derived (${
        error && error.message
      }) — the route rules did not run`,
      findings: [],
    };
  }

  const findings = [];
  for (const file of [...pages, ...routes]) {
    try {
      findings.push(...scanFile(file, root, prefixes, derived));
    } catch {
      // An unreadable file is not a clean file. Say so rather than
      // letting "found nothing" and "looked at nothing" print alike.
      findings.push({
        rule: "file-unreadable",
        file: relative(root, file),
        line: 0,
        detail: "the file could not be read, so it was not checked",
      });
    }
  }
  return { prefixes, pages: pages.length, routes: routes.length, unknown: null, findings };
}

function main() {
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-internal-surface] the fleet root ${dir} does not exist.`);
    return 2;
  }

  const production = productionProfile();

  const roots = candidateRoots(dir);
  const rootSet = new Set(roots);

  // EVERY tree is classified by what it can DEPLOY. The previous version
  // classified by where it was found and dropped any linked tree that was
  // also a canonical root — which is precisely how two ARCHIVED copies of
  // this repo, both carrying the production Vercel link, came to be
  // reported as "live surface — a canonical checkout". A tree's link is
  // the fact that decides whether a finding in it is a leak.
  const links = new Map();
  for (const checkout of deployableCheckouts(dir)) {
    if (!looksLikeSite(checkout.dir)) continue;
    if (links.has(checkout.dir)) continue;
    const link = vercelLink(checkout.dir);
    links.set(checkout.dir, {
      projectId: link?.projectId ?? checkout.projectId,
      projectName: link?.projectName ?? null,
    });
  }

  // Every site tree, once: canonical roots, linked checkouts, and the
  // unlinked sites — unioned, so no tree is scanned twice and none is
  // scanned under a grade it does not deserve.
  const trees = new Map();
  const addTree = (root) => {
    if (!trees.has(root)) trees.set(root, { root, link: links.get(root) ?? null });
  };
  for (const root of roots) addTree(root);
  for (const root of links.keys()) addTree(root);
  const unlinked = unlinkedSites(dir).filter(
    (p) => !rootSet.has(p) && !links.has(p),
  );
  for (const root of unlinked) addTree(root);

  const productionTrees = [...trees.values()].filter(
    (t) => t.link && production.projectId && t.link.projectId === production.projectId,
  );

  console.log(
    `[fleet-internal-surface] ${trees.size} site tree(s) under ${dir} — ` +
      `${productionTrees.length} linked to the PRODUCTION project` +
      `${production.domain ? ` (${production.domain})` : ""}, ` +
      `${[...trees.values()].filter((t) => t.link && t.link.projectId !== production.projectId).length} linked to another project, ` +
      `${[...trees.values()].filter((t) => !t.link).length} with no Vercel link\n`,
  );

  let pages = 0;
  let routes = 0;
  const findings = [];
  const unknown = [];
  const noPrefixes = [];

  const gradeOf = (tree) => {
    if (tree.link && production.projectId && tree.link.projectId === production.projectId) {
      return `linked copy of the PRODUCTION project${production.domain ? ` (${production.domain})` : ""} — a \`vercel --prod\` here ships to production`;
    }
    if (tree.link) {
      return `linked copy of Vercel project ${tree.link.projectName ?? tree.link.projectId}`;
    }
    if (rootSet.has(tree.root)) return "canonical checkout — a live surface";
    return "unlinked tree — not deployable today, one `vercel link` away";
  };

  const sweep = (tree) => {
    const grade = gradeOf(tree);
    const result = scanTree(tree.root);
    pages += result.pages;
    routes += result.routes;

    if (result.unknown) {
      unknown.push({ root: tree.root, reason: result.unknown, grade });
      return;
    }
    if (!result.prefixes.length) {
      noPrefixes.push({ root: tree.root, grade, pages: result.pages, routes: result.routes });
    }
    if (!result.findings.length) return;

    console.error(`\n${tree.root} — ${grade}`);
    for (const f of result.findings) {
      console.error(
        `  ${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""} — ${f.detail}`,
      );
    }
    findings.push(...result.findings);
  };

  // The trees that can ship to production come FIRST. A finding in a
  // production-linked tree is a leak in waiting; a finding in an
  // unlinked scratch tree is a curiosity. Printing them in one undifferentiated
  // list is how a reader learns to skip the report.
  const ordered = [
    ...productionTrees,
    ...[...trees.values()].filter(
      (t) => t.link && !(production.projectId && t.link.projectId === production.projectId),
    ),
    ...[...trees.values()].filter((t) => !t.link && rootSet.has(t.root)),
    ...[...trees.values()].filter((t) => !t.link && !rootSet.has(t.root)),
  ];
  for (const tree of ordered) sweep(tree);

  // The population that carries a link, grouped by project. Forty stale
  // copies of one repo carrying the same six defects is one fact, not
  // forty — and printing forty blocks is how a reader learns to skip the
  // report. The PRODUCTION project is named, because a finding in one of
  // its copies is a leak in waiting rather than a curiosity.
  const byProject = new Map();
  for (const tree of ordered) {
    if (!tree.link) continue;
    const key = tree.link.projectId;
    const entry = byProject.get(key) || {
      copies: [],
      projectName: tree.link.projectName,
      production: production.projectId === tree.link.projectId,
    };
    if (!entry.copies.includes(tree.root)) entry.copies.push(tree.root);
    byProject.set(key, entry);
  }

  for (const [projectId, entry] of byProject) {
    console.error(
      `\n${entry.copies.length} tree(s) carry the Vercel link for project ` +
        `${entry.projectName ?? projectId}${entry.production ? " — PRODUCTION" : ""}:`,
    );
    for (const copy of entry.copies) {
      console.error(`    ${relative(dir, copy) || "."}`);
    }
  }

  for (const u of unknown) {
    console.error(`\n${u.root}\n  UNKNOWN — ${u.reason}`);
  }
  for (const n of noPrefixes) {
    console.error(
      `\n${n.root}\n  no internal prefixes — this tree declares no "internal" ` +
        `surface in app/robots.ts, so its ${n.pages} page(s) were not judged against ` +
        `the page rules. That is a statement about the tree, not a clean bill of health.`,
    );
  }

  const summary =
    `[fleet-internal-surface] ${pages} page(s) and ${routes} route(s) checked across ` +
    `${trees.size} tree(s) — `;

  if (!findings.length) {
    console.log(
      summary +
        `no findings. No internal surface in the fleet serves privileged data to an ` +
        `anonymous caller.`,
    );
  } else {
    console.error(`\n${summary}${findings.length} finding(s).`);
    console.error(
      "[fleet-internal-surface] noindex is not protection. Robots keeps crawlers out " +
        "of the index; it does nothing for a person with the URL. The protection is a " +
        "credential check on the data read, and the credential has to travel with the " +
        "request.",
    );
  }

  if (unknown.length) {
    console.error(
      `[fleet-internal-surface] ${unknown.length} tree(s) are UNKNOWN — the route ` +
        `rules did not run there. An unknown tree is not a clean tree.`,
    );
    return reportOnly ? 0 : 2;
  }

  return findings.length ? (reportOnly ? 0 : 1) : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
