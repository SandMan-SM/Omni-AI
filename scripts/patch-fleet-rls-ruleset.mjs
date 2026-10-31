#!/usr/bin/env node
/**
 * Sync the RLS rule set and the RLS gate into every fleet tree that
 * carries them.
 *
 * Why this exists: `scripts/anon-locked-tables.json` is the RULE SET of
 * `npm run audit:rls` — without it the locked-table rules have no tables
 * to check and the gate must fail closed. The rule set was rebuilt from
 * the live PERMISSION MODEL (a count-based rule set cannot tell a locked
 * table from a public one when the table is empty), and it now also
 * carries the schema's table list so the gate can tell "this table does
 * not exist" from "this table is locked".
 *
 * That makes the previous rule set format stale, and a tree carrying the
 * stale one cannot run the gate at all. So the sweep stopped measuring
 * those trees — 32 of them — which is the same blind spot the cron-auth
 * sweep had: a gate that reports "could not be checked" for most of the
 * fleet is not a measurement.
 *
 * Only two files are written, and only into trees that already carry the
 * rule set or the gate:
 *
 *   scripts/anon-locked-tables.json  — the rule set
 *   scripts/audit-anon-rls.ts        — the gate that reads it
 *
 * No application code is touched: the 30 deployable copies of this repo
 * carry their own commits and uncommitted work, and re-syncing app code
 * would destroy it. That decision is the owner's (see AGENT_MEMORY).
 *
 * Usage:
 *   node scripts/patch-fleet-rls-ruleset.mjs            # report + write
 *   node scripts/patch-fleet-rls-ruleset.mjs --dry-run  # report only
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";

const FLEET_ROOT = process.env.OMNI_FLEET_ROOT || join(process.env.HOME, "Desktop", "Clients");
const CANONICAL = process.cwd();
const RULE_SET = join("scripts", "anon-locked-tables.json");
const GATE = join("scripts", "audit-anon-rls.ts");
const DRY_RUN = process.argv.includes("--dry-run");

/** Every tree in the fleet that carries the rule set (the family marker). */
function ruleSetTrees(dir) {
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
      if (existsSync(join(path, RULE_SET))) {
        found.push(path);
        continue; // do not descend — a nested tree is a copy of a copy
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

function sameFile(a, b) {
  try {
    return readFileSync(a, "utf8") === readFileSync(b, "utf8");
  } catch {
    return false;
  }
}

function main() {
  if (!existsSync(join(CANONICAL, RULE_SET))) {
    console.error("[fleet-ruleset] this checkout has no rule set — nothing to sync from.");
    return 2;
  }
  const trees = ruleSetTrees(FLEET_ROOT).filter((t) => t !== CANONICAL);
  let ruleSetWritten = 0;
  let gateWritten = 0;
  let gateAdded = 0;

  for (const tree of trees) {
    const changes = [];

    const treeRuleSet = join(tree, RULE_SET);
    if (!sameFile(treeRuleSet, join(CANONICAL, RULE_SET))) {
      changes.push("rule set");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, RULE_SET), treeRuleSet);
      ruleSetWritten += 1;
    }

    const treeGate = join(tree, GATE);
    if (!existsSync(treeGate)) {
      changes.push("gate (added)");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, GATE), treeGate);
      gateAdded += 1;
    } else if (!sameFile(treeGate, join(CANONICAL, GATE))) {
      changes.push("gate");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, GATE), treeGate);
      gateWritten += 1;
    }

    if (changes.length) {
      console.log(
        `  ${DRY_RUN ? "would sync" : "synced"}  ${relative(FLEET_ROOT, tree)} — ${changes.join(", ")}`,
      );
    }
  }

  console.log(
    `\n[fleet-ruleset] ${trees.length} tree(s) carry the rule set. ` +
      `${ruleSetWritten} rule set(s) and ${gateWritten + gateAdded} gate(s) ` +
      `${DRY_RUN ? "would be" : "were"} written (${gateAdded} gate(s) added where the tree had none).`,
  );
  console.log(
    "[fleet-ruleset] No application code was touched. A copy that reads a locked table with the " +
      "anon key still answers 200 with an empty array; the rule set only makes the gate able to SEE it.",
  );
  return 0;
}

process.exit(main());
