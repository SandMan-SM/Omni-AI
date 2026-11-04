#!/usr/bin/env node
/**
 * Carry the failed-lookup classifier, its gate and its unit test into the
 * fleet copies that need them.
 *
 * Why this exists
 *
 * The defect class travels BY COPY. The flagship was fixed on 2026-11-04 by
 * adding `lib/server/content-lookup.ts` and a gate that fails the build
 * when a page answers 404 because a database read failed. The sweep
 * (`npm run audit:fleet-content-lookup`) found the same shape in two live
 * surfaces — `Love Thy Barber/Website` and `Omni Leads/Website` — and in
 * two stale scratch worktrees of this repo.
 *
 * A finding is a to-do list. This is the toolbox.
 *
 * What it writes
 *
 *   lib/server/content-lookup.ts      — the classifier (a library, not
 *                                       application code: adding it changes
 *                                       nothing until a read is routed
 *                                       through it)
 *   scripts/audit-content-lookup.mjs   — the gate
 *   tests/content-lookup.test.ts       — the unit test that pins the
 *                                       classifier's PGRST116 mapping
 *   package.json                       — `audit:content-lookup` and
 *                                       `test:content-lookup` scripts, and
 *                                       the gate in the `build` chain
 *
 * What it never writes
 *
 * Application code. The copies carry their own commits and their own
 * uncommitted work, and rewriting a page's read from the outside is how a
 * fleet loses a change it did not make. The RULES are installed; the FIX
 * is made by whoever owns the surface, deliberately, under a lease.
 *
 * The build chain
 *
 * The gate is armed in a copy's `build` script only when the copy is
 * CLEAN — it passes the gate today. Arming it in a copy that still has
 * the defect would block that copy's next deploy for a reason that has
 * nothing to do with what it was deploying, and a blocked deploy gets
 * force-pushed around, which is worse than the defect. So: a copy with
 * findings gets the instruments and a printed to-do list, and the gate is
 * armed on the next run, after the fix.
 *
 * Usage:
 *   node scripts/patch-fleet-content-lookup.mjs             # report + write
 *   node scripts/patch-fleet-content-lookup.mjs --dry-run
 *   node scripts/patch-fleet-content-lookup.mjs --dir <path>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanFile } from "./audit-content-lookup.mjs";
import { candidateRoots, pageFiles } from "./fleet-trees.mjs";

// `fileURLToPath`, not `new URL(...).pathname`: a URL pathname percent-
// encodes spaces, and this repo's path has one.
const CANONICAL = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLASSIFIER = join("lib", "server", "content-lookup.ts");
const GATE = join("scripts", "audit-content-lookup.mjs");
const TEST = join("tests", "content-lookup.test.ts");

function parseArgs(argv) {
  const options = {
    dryRun: false,
    dir: join(homedir(), "Desktop", "Clients"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") options.dryRun = true;
    else if (a === "--dir") options.dir = resolve(argv[++i]);
  }
  return options;
}

function sameFile(a, b) {
  try {
    return readFileSync(a, "utf8") === readFileSync(b, "utf8");
  } catch {
    return false;
  }
}

/** Copy a file into a tree, creating the directory it lives in. */
function copyInto(tree, relativePath) {
  const from = join(CANONICAL, relativePath);
  const to = join(tree, relativePath);
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return true;
}

/**
 * Add the two scripts, and arm the gate in the build chain.
 *
 * The build chain is only armed when the copy passes the gate: a build
 * that fails for a defect the owner has not been told about yet is a
 * build that gets skipped, and a skipped gate is not a gate.
 */
function wireScripts(tree, findings, dryRun) {
  const pkgPath = join(tree, "package.json");
  if (!existsSync(pkgPath)) return { changed: false, armed: false };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return { changed: false, armed: false };
  }
  pkg.scripts = pkg.scripts || {};
  const wanted = {
    "audit:content-lookup": "node scripts/audit-content-lookup.mjs",
    "test:content-lookup": "node --test tests/content-lookup.test.ts",
  };
  let changed = false;
  for (const [name, command] of Object.entries(wanted)) {
    if (pkg.scripts[name] !== command) {
      pkg.scripts[name] = command;
      changed = true;
    }
  }
  const build = pkg.scripts.build || "";
  const gateStep = "npm run audit:content-lookup && npm run test:content-lookup && ";
  const shouldArm = findings.length === 0;
  const armed = build.includes("audit:content-lookup");
  if (shouldArm && !armed) {
    pkg.scripts.build = gateStep + build;
    changed = true;
  }
  if (changed && !dryRun) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  return { changed, armed: shouldArm && (armed || changed) };
}

/**
 * The scratch worktrees of the canonical checkout.
 *
 * A worktree is a THROW-AWAY branch of a surface, not a surface. It has
 * no deploy method of its own, and it is not where a fix belongs — the
 * fix belongs in the canonical tree, and the worktree should be refreshed
 * from it or deleted. Copying instruments into one would make it look
 * maintained when it is stale by construction.
 *
 * EXCEPT when the worktree holds a live `.vercel` link. A tree with a
 * project link can DEPLOY — `vercel --prod` from that folder ships it —
 * so a defect sitting in it is one command away from production. That
 * makes it a surface in every sense that matters, and it is exactly the
 * hazard the precedent recorded: the archived copies of this checkout
 * were patched for this reason, because each one held a live link to the
 * production project.
 */
function canonicalWorktrees() {
  const out = new Set();
  try {
    const raw = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: CANONICAL,
      encoding: "utf8",
    });
    for (const line of raw.split("\n")) {
      if (!line.startsWith("worktree ")) continue;
      out.add(resolve(line.slice("worktree ".length)));
    }
  } catch {
    // No git, or no worktrees. The sweep then simply has more to look at.
  }
  return out;
}

function main() {
  const { dryRun, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-content-lookup-patch] the fleet root ${dir} does not exist.`);
    return 2;
  }
  if (!existsSync(join(CANONICAL, CLASSIFIER))) {
    console.error("[fleet-content-lookup-patch] this checkout has no classifier — nothing to carry.");
    return 2;
  }

  const worktrees = canonicalWorktrees();
  const roots = candidateRoots(dir).filter((root) => root !== CANONICAL);
  let treesPatched = 0;
  let armed = 0;
  let withFindings = 0;
  let skipped = 0;

  for (const tree of roots) {
    const findings = [];
    for (const file of pageFiles(tree)) {
      try {
        findings.push(...scanFile(file, tree));
      } catch {
        findings.push({
          rule: "page-unreadable",
          file: relative(tree, file),
          line: 0,
          detail: "the file could not be read, so it was not checked",
        });
      }
    }

    const carriesGate = existsSync(join(tree, GATE));
    // A scratch worktree is skipped — UNLESS it holds a live `.vercel`
    // project link, which means a `vercel --prod` from that folder can
    // ship it. Such a tree is deployable, so it is patched.
    if (worktrees.has(tree) && !existsSync(join(tree, ".vercel", "project.json"))) {
      if (findings.length) {
        skipped += 1;
        console.log(
          `  skipped  ${relative(dir, tree)} — a scratch worktree of the canonical checkout ` +
            `(${findings.length} finding(s); refresh it from main or delete it, do not patch it)`,
        );
      }
      continue;
    }
    // Only trees that carry the defect, or that already carry the gate,
    // are touched. A fleet of 65 checkouts does not all need the
    // instrument; the ones that do are the ones this class has reached.
    if (!findings.length && !carriesGate) continue;

    const changes = [];
    for (const relativePath of [CLASSIFIER, GATE, TEST]) {
      const to = join(tree, relativePath);
      if (!sameFile(to, join(CANONICAL, relativePath))) {
        changes.push(relativePath);
        if (!dryRun) copyInto(tree, relativePath);
      }
    }
    const wiring = wireScripts(tree, findings, dryRun);
    if (wiring.changed) changes.push("package.json");

    // A tree that already carries the instruments and passes the gate is
    // still a tree the class has reached, and it is still a tree whose
    // build chain is armed. It is counted as such even when there is
    // nothing left to write — a report that only counts the trees it
    // changed understates the fleet's coverage.
    if (wiring.armed) armed += 1;
    if (findings.length) withFindings += 1;
    if (!changes.length && !findings.length) {
      if (wiring.armed) {
        console.log(
          `  current  ${relative(dir, tree)} — instruments already current, gate armed in the build chain`,
        );
      }
      continue;
    }
    treesPatched += 1;

    console.log(
      `  ${dryRun ? "would patch" : "patched"}  ${relative(dir, tree)} — ` +
        `${changes.length ? changes.join(", ") : "instruments already current"}` +
        (findings.length
          ? `  ⚠ ${findings.length} finding(s): the gate is NOT armed in this tree until they are fixed`
          : wiring.armed
            ? "  gate armed in the build chain"
            : ""),
    );
    for (const f of findings) {
      console.log(`      ${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""}`);
    }
  }

  console.log(
    `\n[fleet-content-lookup-patch] ${roots.length} tree(s) outside the canonical checkout; ` +
      `${treesPatched} patched, ${armed} with the gate armed in the build chain, ` +
      `${withFindings} still carrying the defect, ${skipped} scratch worktree(s) skipped.`,
  );
  console.log(
    "[fleet-content-lookup-patch] no application code was touched. Route the read through " +
      "requireLookup(await lookupContent(() => …)) in the surface that owns the page, then run " +
      "this again to arm the gate there.",
  );
  return 0;
}

process.exit(main());
