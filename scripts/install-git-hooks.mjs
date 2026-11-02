#!/usr/bin/env node
/**
 * Install the repository's git hooks.
 *
 * Why this exists
 *
 * The `pre-push` hook is the only control that runs at the exact moment the
 * damage happens. `audit:deploy` detects the state AFTER a release has
 * already been made from a commit git does not contain; the hook refuses the
 * push that would delete that release.
 *
 * Git does not track `.git/hooks`, so the hook lives in `.githooks/` (tracked)
 * and `core.hooksPath` points at it. `core.hooksPath` is repository-local
 * config, so every agent working in this checkout gets it — which is the
 * point: the failure this prevents is caused by a *different* agent releasing
 * from a worktree and not pushing.
 *
 * Usage:
 *   node scripts/install-git-hooks.mjs            # install
 *   node scripts/install-git-hooks.mjs --check    # report, do not change
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const checkOnly = process.argv.includes("--check");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const hooksPath = join(root, ".githooks");

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

if (!existsSync(hooksPath)) {
  console.error(`[hooks] ${hooksPath} does not exist — nothing to install.`);
  process.exit(1);
}

const current = git(["config", "--local", "core.hooksPath"]);
if (current === hooksPath) {
  console.log("[hooks] core.hooksPath already points at the tracked hooks — the pre-push gate is active.");
  process.exit(0);
}
if (checkOnly) {
  console.log(`[hooks] core.hooksPath is ${current ?? "(unset)"} — the pre-push gate is NOT active.`);
  process.exit(1);
}

// The path is ABSOLUTE on purpose. A relative `core.hooksPath` is resolved
// against each worktree's own root, so a worktree checked out at a commit
// that predates `.githooks/` would silently run no hook at all — and the
// worktrees are exactly where the CLI releases happen. An absolute path
// means every worktree of this repository runs the same gate.
git(["config", "--local", "core.hooksPath", hooksPath]);
// The hook must be executable or git silently ignores it — a hook that never
// runs is the worst outcome, because it looks installed.
try {
  execFileSync("chmod", ["+x", join(hooksPath, "pre-push")]);
} catch {
  /* the file may already be executable */
}
console.log(`[hooks] installed: core.hooksPath = ${hooksPath}`);
console.log("[hooks] the pre-push gate now refuses a push that would delete the live production release.");
console.log("[hooks] it applies to every worktree of this repository, because the path is absolute.");
