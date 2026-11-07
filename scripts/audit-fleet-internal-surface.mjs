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
 * Usage:
 *   node scripts/audit-fleet-internal-surface.mjs             # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-internal-surface.mjs --dir <path>
 *   node scripts/audit-fleet-internal-surface.mjs --report     # always exit 0
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

  const roots = candidateRoots(dir);
  const rootSet = new Set(roots);
  const linked = deployableCheckouts(dir).filter(
    (c) => !rootSet.has(c.dir) && looksLikeSite(c.dir),
  );
  const unlinked = unlinkedSites(dir).filter((p) => !rootSet.has(p));

  console.log(
    `[fleet-internal-surface] ${roots.length} canonical site(s), ` +
      `${linked.length} linked cop(y|ies), ${unlinked.length} unlinked site(s) ` +
      `under ${dir}\n`,
  );

  let pages = 0;
  let routes = 0;
  const findings = [];
  const unknown = [];
  const noPrefixes = [];

  const sweep = (root, grade) => {
    const result = scanTree(root);
    pages += result.pages;
    routes += result.routes;

    if (result.unknown) {
      unknown.push({ root, reason: result.unknown, grade });
      return;
    }
    if (!result.prefixes.length) {
      noPrefixes.push({ root, grade, pages: result.pages, routes: result.routes });
    }
    if (!result.findings.length) return;

    console.error(`\n${root} — ${grade}`);
    for (const f of result.findings) {
      console.error(
        `  ${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""} — ${f.detail}`,
      );
    }
    findings.push(...result.findings);
  };

  for (const root of roots) {
    sweep(root, "live surface — a canonical checkout");
  }

  // Linked copies are GROUPED BY PROJECT. Forty stale copies of one repo
  // carrying the same six defects is one fact, not forty — and printing
  // forty blocks is how a reader learns to skip the report.
  const byProject = new Map();
  for (const checkout of linked) {
    const result = scanTree(checkout.dir);
    pages += result.pages;
    routes += result.routes;
    if (result.unknown) {
      unknown.push({
        root: checkout.dir,
        reason: result.unknown,
        grade: `linked copy of ${checkout.projectId}`,
      });
      continue;
    }
    if (!result.prefixes.length) {
      noPrefixes.push({
        root: checkout.dir,
        grade: `linked copy of ${checkout.projectId}`,
        pages: result.pages,
        routes: result.routes,
      });
    }
    if (!result.findings.length) continue;

    const entry = byProject.get(checkout.projectId) || {
      copies: [],
      findings: result.findings,
    };
    entry.copies.push(checkout.dir);
    byProject.set(checkout.projectId, entry);
    findings.push(...result.findings);
  }

  for (const [projectId, entry] of byProject) {
    console.error(
      `\n${entry.copies.length} linked cop(y|ies) of Vercel project ${projectId} — ` +
        `one \`vercel --prod\` away from shipping the same defect:`,
    );
    for (const copy of entry.copies) {
      console.error(`    ${relative(dir, copy) || "."}`);
    }
    for (const f of entry.findings) {
      console.error(
        `  ${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""} — ${f.detail}`,
      );
    }
  }

  for (const root of unlinked) {
    sweep(root, "unlinked tree — not deployable today, one `vercel link` away");
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
    `${roots.length + linked.length + unlinked.length} tree(s) — `;

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
