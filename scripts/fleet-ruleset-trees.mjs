/**
 * ONE definition of "a tree that carries the RLS rule set" — the family
 * marker every instrument in this repo uses to recognise a copy of this
 * platform.
 *
 * WHY THIS EXISTS
 *
 * The patcher (`scripts/patch-fleet-rls-ruleset.mjs`) and the sweep
 * (`scripts/audit-fleet-public-pii.mjs`) both need the same population: the
 * directories under `~/Desktop/Clients` that hold `scripts/anon-locked-tables.json`.
 * Two tools that discover the fleet separately will eventually disagree
 * about it — and when they do, the disagreement is invisible: the patcher
 * writes into one set of trees and the sweep reports on another, and the
 * sweep says "0 findings" about trees the patcher never reached.
 *
 * That is the same lesson as `scripts/fleet-trees.mjs`, which exists because
 * "what is a surface?" was being answered twice.
 *
 * The rule set is the marker because it is the FILE that makes a tree
 * measurable. A tree without it has no way to answer the RLS question, and
 * a tree with it has said it is part of this family.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The file that marks a tree as carrying this platform's rule set. */
export const RULE_SET_MARKER = join("scripts", "anon-locked-tables.json");

/**
 * Every tree under `root` that carries the rule set, sorted.
 *
 * The walk does not descend into a tree that carries the marker: a nested
 * tree is a copy of a copy, and syncing it twice would be noise.
 */
export function ruleSetTrees(root) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const path = join(current, entry.name);
      if (existsSync(join(path, RULE_SET_MARKER))) {
        found.push(path);
        continue; // do not descend — a nested tree is a copy of a copy
      }
      walk(path, depth + 1);
    }
  };
  walk(root, 0);
  return found.sort();
}
