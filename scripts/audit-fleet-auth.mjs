#!/usr/bin/env node
/**
 * Run the cron-auth gate across every client surface in the fleet.
 *
 * Why this exists
 *
 * The defect class the gate catches — a route authenticating a caller with a
 * request header the caller sets, or treating an unset secret as "allow" —
 * was live in production on this repo, in two places at once, and neither
 * `tsc`, `next lint` nor `next build` could see it. The fleet is a set of
 * independent Next.js checkouts that share patterns but not code, so the
 * class can reappear in any of them the moment someone copies a route.
 *
 * Session 54 swept the fleet for the header form by hand and found the defect
 * only in this repo. That sweep is not reproducible and it does not cover the
 * second form (an unset secret compared as though it were set). This script
 * makes the sweep a command.
 *
 * What it scans
 *
 * Every directory under the fleet root that contains an `app/` with a route
 * handler or a `lib/` with modules — the same server surface the single-repo
 * gate scans. Worktrees, release copies and scratch directories are skipped
 * in this phase: they are not deployed surfaces.
 *
 * Second phase: deployable copies. A directory that carries a `.vercel`
 * project link is a tree someone can ship to production with one command.
 * A copy that still holds a defect the canonical surface has already fixed
 * is a loaded gun — that is exactly how the two archived copies of this repo
 * came to carry the session-54 bypasses. Only *divergences* are findings: a
 * copy of an already-dirty project repeats a defect the canonical surface
 * already reported, and a copy of a project with no canonical checkout here
 * cannot be compared at all (reported as a note).
 *
 * The second phase also compares the *operator tooling* of a copy against
 * its canonical surface: a copy whose `audit-env-drift.ts` or
 * `telegram-webhook-setup.mjs` is an older version does not carry the fix,
 * so a script run from that folder reports the wrong thing — a stale
 * credential read as "the endpoint is broken".
 *
 * The third phase covers the trees neither of the first two could see: a
 * scratch tree that carries the defect and carries NO Vercel link. It is
 * not a deployable surface, and the phase does not pretend otherwise — but
 * it is one `vercel --prod` away from being one, and the defect class
 * travels by copy. Twenty-three trees across the fleet carried the
 * session-54 cron bypass this way, invisible to every gate, because they
 * were worktrees without a link.
 *
 * Usage:
 *   node scripts/audit-fleet-auth.mjs                    # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-auth.mjs --dir <path>       # sweep another root
 *   node scripts/audit-fleet-auth.mjs --no-copies        # canonical surfaces only
 *   node scripts/audit-fleet-auth.mjs --no-unlinked      # skip the unlinked-tree phase
 *   node scripts/audit-fleet-auth.mjs --report           # always exit 0
 *
 * The unlinked phase is the slow one — it runs the analyzer over roughly a
 * hundred scratch trees, so the full sweep takes a couple of minutes
 * rather than seconds.
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runAudit } from "./audit-cron-auth.mjs";

/** Directories that hold copies, not the surfaces themselves. */
const SKIP_SEGMENTS = [
  "node_modules",
  "_tmp",
  "_release",
  "_agent-worktrees",
  "_codex-worktrees",
  "_deploy-worktrees",
  "worktrees",
  "__pycache__",
];

function parseArgs(argv) {
  const options = {
    reportOnly: false,
    dir: join(homedir(), "Desktop", "Clients"),
    copies: true,
    unlinked: true,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--no-copies") options.copies = false;
    else if (argv[i] === "--no-unlinked") options.unlinked = false;
    else if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
  }
  return options;
}

/**
 * The Vercel project a checkout is linked to, or null.
 *
 * `.vercel/project.json` is what `vercel --prod` reads to decide which project
 * it deploys to. Two directories carrying the same projectId are two trees
 * that both claim the same production surface.
 */
function vercelProjectId(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, ".vercel", "project.json"), "utf8"));
    return typeof parsed.projectId === "string" ? parsed.projectId : null;
  } catch {
    return null;
  }
}

/**
 * Every directory under the fleet root that is linked to a Vercel project.
 *
 * Unlike `candidateRoots` this walk does not skip worktrees, release copies
 * or scratch directories, and it does not stop at a checkout — those
 * directories are exactly what this phase is about. It still descends into a
 * checkout, because a canonical site often sits next to a linked parent
 * directory (`Imperium/` and `Imperium/Website/` share one project link).
 */
export function deployableCheckouts(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git") continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      const projectId = vercelProjectId(path);
      if (projectId) found.push({ dir: path, projectId });
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found;
}

/**
 * Site trees that carry NO Vercel link.
 *
 * The canonical phase skips worktrees, release copies and scratch
 * directories — they are not deployed surfaces. The copy phase only looks
 * at trees that DO carry a `.vercel` link, because a linked tree is one
 * `vercel --prod` away from shipping.
 *
 * Together those two phases left a hole: a tree with the defect and no
 * link. It is invisible to both — not a canonical surface, not a copy —
 * and it becomes visible only at the moment someone runs `vercel --prod`
 * from it or copies it into a canonical slot. That is not theoretical:
 * twenty-three trees across the fleet carried the session-54 cron bypass
 * in source, and every one of them was invisible to the gate, because
 * they were scratch trees without a Vercel link.
 *
 * So this phase exists to make the population a command. A tree with no
 * link is not a deployable surface, and the findings are reported as
 * such — but a defect sitting in a tree that can become a deployable
 * surface in one command is a finding, not a curiosity.
 */
export function unlinkedSites(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git") continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      if (looksLikeSite(path)) {
        // A linked tree is the copy phase's business; a tree that is not a
        // site at all is not this phase's business either.
        if (!vercelProjectId(path)) found.push(path);
        continue; // do not descend — nested checkouts are copies
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

/**
 * Operator tooling whose stale version reports the WRONG thing.
 *
 * These are not routes — they are the scripts an operator runs to probe
 * production, and a stale copy of one is a script that lies. The old
 * `audit-env-drift.ts` reads the CLI auth file directly and treats any API
 * failure as "no kinds known", so an expired token makes it report every
 * production variable as unreadable. The old `telegram-webhook-setup.mjs`
 * requires a local `CRON_SECRET` that has drifted from production, so it is
 * rejected with a 401 that reads like an endpoint fault rather than a
 * credential mismatch.
 *
 * The check is: if a copy HAS one of these files and its content differs from
 * the canonical surface's, the copy is carrying a version the canonical
 * surface has already fixed. A copy that simply predates the tooling (no file
 * at that path) is not a finding — it never had the problem.
 *
 * The list is deliberately short. `provision-voice-agent.mjs` differs across
 * the fleet too, but its stale version fails with a clear "VOICE_AGENT_SECRET
 * is required" rather than a misleading answer, so including it would report
 * twenty-one copies that are not actually wrong. A gate that cries wolf is a
 * gate that gets ignored.
 */
const SECURITY_TOOLING = [
  "scripts/audit-env-drift.ts",
  "scripts/telegram-webhook-setup.mjs",
];

/** The content of a file, or null when it does not exist. */
function readIfPresent(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * The security-relevant tooling in a copy that differs from its canonical
 * surface. Each entry is a finding.
 */
/**
 * The sibling modules a script imports by relative path.
 *
 * `import { x } from "./vercel-token.mjs"` in `scripts/audit-env-drift.ts`
 * resolves to `scripts/vercel-token.mjs`. A copy that ships the script
 * without the module throws on import, so the operator gets a stack trace
 * instead of a report.
 */
function localImports(content) {
  const found = new Set();
  for (const match of content.matchAll(/from\s+["']\.\/([^"']+)["']/g)) {
    found.add(`scripts/${match[1]}`);
  }
  return [...found];
}

function toolingDivergences(copyDir, canonicalDir) {
  const findings = [];
  for (const relativePath of SECURITY_TOOLING) {
    const copyContent = readIfPresent(join(copyDir, relativePath));
    if (copyContent === null) continue; // the copy predates this tool
    const canonicalContent = readIfPresent(join(canonicalDir, relativePath));
    if (canonicalContent === null) continue; // the canonical surface has no such tool
    if (copyContent !== canonicalContent) {
      findings.push({
        rule: "stale-operator-tooling",
        file: relativePath,
        line: 0,
        detail:
          "the copy's version of this operator script differs from the canonical surface's, " +
          "so it does not carry the fix the canonical surface has already made",
      });
    }
    // The module the current version imports has to be in the copy too —
    // otherwise bringing the script up to date leaves a script that throws
    // on import.
    for (const modulePath of localImports(canonicalContent)) {
      if (readIfPresent(join(copyDir, modulePath)) !== null) continue;
      findings.push({
        rule: "missing-tooling-module",
        file: modulePath,
        line: 0,
        detail:
          "the canonical surface's version of this operator script imports it, but the copy " +
          "does not carry it, so the current script cannot be run from this folder",
      });
    }
  }
  return findings;
}

/** Whether a path segment marks a non-surface copy. */
function isSkippedSegment(segment) {
  return segment.startsWith(".") || SKIP_SEGMENTS.includes(segment);
}

/** Every directory under `dir` that looks like a deployed site checkout. */
function candidateRoots(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 5) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (isSkippedSegment(entry)) continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      if (looksLikeSite(path)) {
        found.push(path);
        continue; // do not descend into a site — nested checkouts are copies
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

/** A directory is a site when it holds an `app/` (or `src/app/`) with a route handler. */
export function looksLikeSite(path) {
  for (const app of [join(path, "app"), join(path, "src", "app")]) {
    if (existsSync(app) && hasRouteHandler(app, 0)) return true;
  }
  return false;
}

function hasRouteHandler(dir, depth) {
  if (depth > 4) return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (isSkippedSegment(entry)) continue;
      if (hasRouteHandler(path, depth + 1)) return true;
      continue;
    }
    if (/^route\.(ts|tsx|js|jsx)$/.test(entry)) return true;
  }
  return false;
}

function main() {
  const { reportOnly, dir, copies, unlinked } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-auth] fleet root not found: ${dir}`);
    return 2;
  }

  const roots = candidateRoots(dir);
  console.log(`[fleet-auth] ${roots.length} site checkout(s) under ${dir}\n`);

  let totalFindings = 0;
  /** The canonical surface and finding count per Vercel project. */
  const canonicalByProject = new Map();
  for (const root of roots) {
    const { findings, files } = runAudit(root);
    const label = relative(dir, root) || ".";
    const projectId = vercelProjectId(root);
    if (projectId) {
      const entry = canonicalByProject.get(projectId);
      if (entry) entry.findings += findings.length;
      else canonicalByProject.set(projectId, { dir: root, findings: findings.length });
    }
    if (!findings.length) {
      console.log(`  ok    ${label} — ${files} files`);
      continue;
    }
    totalFindings += findings.length;
    console.log(`  FIND  ${label} — ${findings.length} finding(s) in ${files} files`);
    for (const finding of findings) {
      console.log(
        `          ${finding.rule}  ${finding.file}${finding.line ? `:${finding.line}` : ""} — ${finding.detail}`,
      );
    }
  }

  // Phase two: deployable copies.
  //
  // A checkout that carries a `.vercel` link is a tree someone can deploy to
  // production with one command. When that copy still holds a defect the
  // canonical surface has already fixed, the fix is one `vercel --prod` away
  // from being undone — which is exactly how the two archived copies of this
  // repo came to carry the session-54 bypasses.
  //
  // Only *divergences* count. A copy whose project is already dirty is the
  // same defect the canonical surface reported; a copy of a project with no
  // canonical surface here cannot be compared and is reported separately as
  // informational, never as a finding.
  const divergences = [];
  const orphans = [];
  if (copies) {
    const rootSet = new Set(roots);
    for (const checkout of deployableCheckouts(dir)) {
      if (rootSet.has(checkout.dir)) continue;
      if (!looksLikeSite(checkout.dir)) continue;
      const canonical = canonicalByProject.get(checkout.projectId);
      if (canonical === undefined) {
        orphans.push(checkout.dir);
        continue;
      }
      const findings = [];
      // The cron-auth rules: only *divergences* count. A copy of an
      // already-dirty project repeats a defect the canonical surface already
      // reported.
      if (canonical.findings === 0) {
        findings.push(...runAudit(checkout.dir).findings);
      }
      // The operator tooling: a copy whose script differs from the
      // canonical surface's is carrying a version the canonical surface has
      // already fixed. This is checked whether or not the canonical surface
      // is clean — the two classes are unrelated.
      findings.push(...toolingDivergences(checkout.dir, canonical.dir));
      if (findings.length) divergences.push({ ...checkout, findings });
    }
  }

  if (copies) {
    console.log(
      `\n[fleet-auth] copy scan — ${divergences.length} divergent copy/copies, ` +
        `${orphans.length} checkout(s) with no canonical surface here`,
    );
    for (const divergence of divergences) {
      console.log(
        `  DIVERGE  ${relative(dir, divergence.dir)} — ${divergence.findings.length} finding(s) in a copy of project ${divergence.projectId}`,
      );
      for (const finding of divergence.findings) {
        console.log(
          `          ${finding.rule}  ${finding.file}${finding.line ? `:${finding.line}` : ""} — ${finding.detail}`,
        );
      }
    }
    for (const orphan of orphans) {
      console.log(`  note     ${relative(dir, orphan)} — linked to a project with no canonical checkout under this root`);
    }
  }

  // Phase three: trees that carry no Vercel link.
  //
  // A scratch tree is not a deployable surface, and this phase does not
  // pretend otherwise — but the defect class travels by copy, and a tree
  // with the defect and no link becomes a deployable surface the moment
  // someone runs `vercel --prod` from it or copies it into a canonical
  // slot. Before this phase existed, twenty-three trees carrying the
  // session-54 bypass were invisible to the gate.
  const unlinkedFindings = [];
  let unlinkedScanned = 0;
  if (unlinked) {
    for (const tree of unlinkedSites(dir)) {
      unlinkedScanned += 1;
      const { findings } = runAudit(tree);
      if (findings.length) {
        unlinkedFindings.push({ dir: tree, findings });
      }
    }
    console.log(
      `\n[fleet-auth] unlinked tree scan — ${unlinkedScanned} tree(s) with no Vercel link, ` +
        `${unlinkedFindings.length} carrying a defect`,
    );
    for (const entry of unlinkedFindings) {
      console.log(
        `  FIND  ${relative(dir, entry.dir)} — ${entry.findings.length} finding(s) in a tree with no Vercel link`,
      );
      for (const finding of entry.findings) {
        console.log(
          `          ${finding.rule}  ${finding.file}${finding.line ? `:${finding.line}` : ""} — ${finding.detail}`,
        );
      }
    }
  }

  if (!totalFindings && !divergences.length && !unlinkedFindings.length) {
    console.log("\n[fleet-auth] no findings — no surface authenticates with a client-set header, and no secret comparison is unguarded.");
    return 0;
  }
  const summary = [];
  if (totalFindings) {
    summary.push(
      `${totalFindings} finding(s) across the fleet. ` +
        "A request header is chosen by the caller; it is not a credential. " +
        "Authenticate with a shared secret or a session, and fail closed when the secret is unset.",
    );
  }
  if (divergences.length) {
    summary.push(
      `${divergences.length} deployable copy/copies still carry a defect the canonical surface has fixed. ` +
        "A `vercel --prod` from one of them ships that tree to production — patch it or delete it. " +
        "A `stale-operator-tooling` finding means the copy's operator script does not carry the " +
        "canonical fix, so a script run from that folder reports the wrong thing.",
    );
  }
  if (unlinkedFindings.length) {
    summary.push(
      `${unlinkedFindings.length} tree(s) with no Vercel link still carry a defect. ` +
        "They cannot be shipped as they stand, and they are one `vercel --prod` away from shipping — " +
        "patch them, or delete the tree. A tree that is not linked today can be linked tomorrow.",
    );
  }
  console.error(`\n[fleet-auth] ${summary.join(" ")}`);
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
