#!/usr/bin/env node
/**
 * Fleet sweep: does a tree VERIFY its bearer, or merely DECODE it?
 *
 * Why this exists
 *
 * The forgeable-`omni_token` class was found on 2026-11-07 "by accident" —
 * the internal-surface sweep was looking for a different thing and its
 * author noticed the decoder while reading a copy's `lib/admin-auth.ts`. A
 * defect class that is only reported when somebody happens to be looking is
 * a class with no instrument.
 *
 * The instrument is `scripts/audit-credential-verification.mjs`. It is
 * IMPORTED here, so the fleet's answer and the canonical tree's answer
 * cannot disagree about what the rule IS.
 *
 * THE FLEET IS ONE DEFINITION
 *
 * The tree population comes from `scripts/fleet-trees.mjs` and
 * `scripts/audit-fleet-auth.mjs` — the SAME two modules every other fleet
 * tool uses — and the production project is derived from this checkout's own
 * `.vercel` link and its own `lib/seo.ts` (re-exported from
 * `audit-fleet-internal-surface.mjs`, so two tools cannot judge production by
 * two different constants).
 *
 * A TREE IS GRADED BY WHAT IT CAN DEPLOY
 *
 * `.vercel/project.json` is what `vercel --prod` reads. A directory carrying
 * one is a deployable tree, whatever else it looks like — an archive, a
 * worktree, a scratch copy. The production-linked trees are reported FIRST,
 * because a finding there is a leak in waiting and a finding in an unlinked
 * scratch tree is a curiosity.
 *
 * Usage:
 *   node scripts/audit-fleet-credential-verification.mjs            # exit 1 on findings
 *   node scripts/audit-fleet-credential-verification.mjs --report   # always exit 0
 *   node scripts/audit-fleet-credential-verification.mjs --dir <dir># fleet root
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { candidateRoots } from "./fleet-trees.mjs";
import { deployableCheckouts, looksLikeSite, unlinkedSites } from "./audit-fleet-auth.mjs";
import { productionProfile, vercelLink } from "./audit-fleet-internal-surface.mjs";
import { scanTree } from "./audit-credential-verification.mjs";

function parseArgs(argv) {
  const options = { reportOnly: argv.includes("--report"), dir: join(homedir(), "Desktop", "Clients") };
  const index = argv.indexOf("--dir");
  if (index !== -1 && argv[index + 1]) options.dir = argv[index + 1];
  return options;
}

function main() {
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-credential-verification] the fleet root ${dir} does not exist.`);
    return 2;
  }

  const production = productionProfile();
  const roots = candidateRoots(dir);
  const rootSet = new Set(roots);

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
  for (const root of unlinkedSites(dir)) {
    if (!rootSet.has(root) && !links.has(root)) addTree(root);
  }

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

  const productionTrees = [...trees.values()].filter(
    (t) => t.link && production.projectId && t.link.projectId === production.projectId,
  );

  console.log(
    `[fleet-credential-verification] ${trees.size} site tree(s) under ${dir} — ` +
      `${productionTrees.length} linked to the PRODUCTION project` +
      `${production.domain ? ` (${production.domain})` : ""}, ` +
      `${[...trees.values()].filter((t) => t.link && t.link.projectId !== production.projectId).length} linked to another project, ` +
      `${[...trees.values()].filter((t) => !t.link).length} with no Vercel link\n`,
  );

  const results = [];
  const unknown = [];
  for (const tree of trees.values()) {
    if (!existsSync(join(tree.root, "lib"))) continue;
    let scanned;
    try {
      scanned = scanTree(tree.root);
    } catch (error) {
      unknown.push({ tree, reason: String(error?.message ?? error) });
      continue;
    }
    if (!scanned.findings.length) continue;
    results.push({ tree, findings: scanned.findings });
  }

  // Production-linked trees first: a finding there is a leak in waiting.
  results.sort((a, b) => {
    const grade = (t) => (t.link && t.link.projectId === production.projectId ? 0 : t.link ? 1 : 2);
    return grade(a.tree) - grade(b.tree);
  });

  for (const result of results) {
    console.error(`\n${result.tree.root} — ${gradeOf(result.tree)}`);
    for (const finding of result.findings) {
      console.error(`  ${finding.rule}  ${finding.file} — ${finding.detail}`);
    }
  }

  const treesWithFindings = results.length;
  const findings = results.reduce((sum, r) => sum + r.findings.length, 0);

  console.error(
    `\n[fleet-credential-verification] ${trees.size} tree(s) examined — ` +
      `${treesWithFindings} carry the class, ${findings} finding(s) in total.`,
  );

  if (results.length) {
    console.error(
      "[fleet-credential-verification] A bearer that is decoded is not a credential. " +
        "Signing the token and verifying the signature are two halves of one contract, " +
        "and they live in two runtimes — the Next.js server and the Supabase edge " +
        "function that mints the login token.",
    );
  }

  if (unknown.length) {
    console.error(
      `[fleet-credential-verification] ${unknown.length} tree(s) are UNKNOWN — the rules ` +
        "did not run there. An unknown tree is not a clean tree.",
    );
    return reportOnly ? 0 : 2;
  }

  return findings ? (reportOnly ? 0 : 1) : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
