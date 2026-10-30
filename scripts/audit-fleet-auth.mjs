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
 * Usage:
 *   node scripts/audit-fleet-auth.mjs                    # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-auth.mjs --dir <path>       # sweep another root
 *   node scripts/audit-fleet-auth.mjs --no-copies        # canonical surfaces only
 *   node scripts/audit-fleet-auth.mjs --report           # always exit 0
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
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--no-copies") options.copies = false;
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
  const { reportOnly, dir, copies } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-auth] fleet root not found: ${dir}`);
    return 2;
  }

  const roots = candidateRoots(dir);
  console.log(`[fleet-auth] ${roots.length} site checkout(s) under ${dir}\n`);

  let totalFindings = 0;
  /** Findings per Vercel project, from the canonical surfaces only. */
  const canonicalByProject = new Map();
  for (const root of roots) {
    const { findings, files } = runAudit(root);
    const label = relative(dir, root) || ".";
    const projectId = vercelProjectId(root);
    if (projectId) {
      canonicalByProject.set(projectId, (canonicalByProject.get(projectId) ?? 0) + findings.length);
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
      if (canonical > 0) continue; // already reported on the canonical surface
      const { findings } = runAudit(checkout.dir);
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

  if (!totalFindings && !divergences.length) {
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
        "A `vercel --prod` from one of them ships that tree to production — patch it or delete it.",
    );
  }
  console.error(`\n[fleet-auth] ${summary.join(" ")}`);
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
