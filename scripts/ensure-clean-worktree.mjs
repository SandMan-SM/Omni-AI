#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const phaseIndex = process.argv.indexOf("--phase");
const phase =
  phaseIndex >= 0 && process.argv[phaseIndex + 1]
    ? process.argv[phaseIndex + 1]
    : "check";

if (process.env.ALLOW_DIRTY_WORKTREE === "1" || args.has("--allow-dirty")) {
  console.warn(
    `[worktree:${phase}] ALLOW_DIRTY_WORKTREE is set; skipping clean-tree guard.`,
  );
  process.exit(0);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const root = git(["rev-parse", "--show-toplevel"]);
process.chdir(root);

const status = git(["status", "--porcelain=v1"]);

if (!status) {
  console.log(`[worktree:${phase}] clean`);
  process.exit(0);
}

const files = status
  .split("\n")
  .filter(Boolean)
  .map((line) => `  ${line}`)
  .join("\n");

console.error(`\n[worktree:${phase}] blocked: dirty git worktree\n`);
console.error(files);
console.error(`
Commit, stash, or intentionally discard the changes before running this command.
For a one-off emergency only, rerun with ALLOW_DIRTY_WORKTREE=1.
`);
process.exit(1);
