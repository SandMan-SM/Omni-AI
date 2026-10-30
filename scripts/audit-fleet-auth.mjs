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
 * gate scans. Worktrees, release copies and scratch directories are skipped:
 * they are not deployed surfaces, and a stale copy of a fixed tree would
 * otherwise report the same finding forever.
 *
 * Usage:
 *   node scripts/audit-fleet-auth.mjs                    # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-auth.mjs --dir <path>       # sweep another root
 *   node scripts/audit-fleet-auth.mjs --report           # always exit 0
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
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
  const options = { reportOnly: false, dir: join(homedir(), "Desktop", "Clients") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
  }
  return options;
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
function looksLikeSite(path) {
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
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-auth] fleet root not found: ${dir}`);
    return 2;
  }

  const roots = candidateRoots(dir);
  console.log(`[fleet-auth] ${roots.length} site checkout(s) under ${dir}\n`);

  let totalFindings = 0;
  for (const root of roots) {
    const { findings, files } = runAudit(root);
    const label = relative(dir, root) || ".";
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

  if (!totalFindings) {
    console.log("\n[fleet-auth] no findings — no surface authenticates with a client-set header, and no secret comparison is unguarded.");
    return 0;
  }
  console.error(
    `\n[fleet-auth] ${totalFindings} finding(s) across the fleet. ` +
      "A request header is chosen by the caller; it is not a credential. " +
      "Authenticate with a shared secret or a session, and fail closed when the secret is unset.",
  );
  return reportOnly ? 0 : 1;
}

process.exit(main());
