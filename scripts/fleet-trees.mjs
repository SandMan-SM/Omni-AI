#!/usr/bin/env node
/**
 * Finding the fleet's site checkouts.
 *
 * WHY THIS IS SHARED
 *
 * Three tools now walk the same fleet: the content-lookup sweep
 * (`audit-fleet-content-lookup`), the patcher that carries the classifier
 * and the gate into a copy (`patch-fleet-content-lookup`), and the other
 * fleet gates. When each of them discovers trees on its own, they
 * eventually DISAGREE about what the fleet is — and two tools that
 * disagree about their subject area cannot both be right.
 *
 * So the discovery lives here, once.
 *
 * WHAT COUNTS AS A SURFACE
 *
 * A directory with an `app/` (or `src/app/`) that contains a `page.tsx`.
 * That is the definition of "a Next.js checkout that serves pages", and it
 * is deliberately narrower than "a git repository": the fleet contains
 * backends, agents, receivers and scratch worktrees that serve no pages,
 * and a sweep that reported findings in those would be reporting noise.
 *
 * The SKIP list is where the fleet keeps its scratch trees. A copy under
 * `_agent-worktrees/`, `_deploy-worktrees/` or `_tmp/` is a throwaway
 * branch of a real surface, not a surface of its own.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Directories that hold copies, not the surfaces themselves. */
export const SKIP_SEGMENTS = [
  "node_modules",
  "_tmp",
  "_release",
  "_agent-worktrees",
  "_codex-worktrees",
  "_deploy-worktrees",
  "worktrees",
  "__pycache__",
  ".git",
  ".next",
  ".next-prod",
  "dist",
  "build",
  "out",
  "coverage",
  "docs",
];

export function isSkippedSegment(entry) {
  return SKIP_SEGMENTS.includes(entry) || entry.startsWith(".");
}

/** Does this tree contain a `page.tsx` anywhere under `app/`? */
export function hasPage(dir, depth = 0) {
  if (depth > 5) return false;
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
      if (hasPage(path, depth + 1)) return true;
    } else if (/^page\.(tsx|jsx)$/.test(entry)) {
      return true;
    }
  }
  return false;
}

/** Is this directory a Next.js checkout that serves pages? */
export function looksLikeSite(path) {
  for (const app of [join(path, "app"), join(path, "src", "app")]) {
    if (existsSync(app) && hasPage(app, 0)) return true;
  }
  return false;
}

/**
 * Every canonical site checkout under `dir`.
 *
 * A site is not descended into: a checkout inside a checkout is a copy, and
 * the copy is where a defect travels.
 */
export function candidateRoots(dir) {
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

/** Every page in a checkout. */
export function pageFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
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
        if (entry === "node_modules" || entry === ".next") continue;
        walk(path, depth + 1);
      } else if (/^page\.(tsx|jsx)$/.test(entry)) {
        out.push(path);
      }
    }
  };
  for (const app of [join(root, "app"), join(root, "src", "app")]) {
    if (existsSync(app)) walk(app, 0);
  }
  return out;
}
