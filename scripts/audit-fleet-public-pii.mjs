#!/usr/bin/env node
/**
 * Sweep: can every copy of this platform MEASURE its own public-PII
 * exposure, and what does it measure?
 *
 * WHY THIS EXISTS
 *
 * The public-PII gate — the only instrument in this repo asking "does an
 * unauthenticated route hand somebody else's identity to any caller?" —
 * used to be built on two hand-typed lists: six table names and forty
 * marker strings. It now carries a GENERATED rule set (`scripts/pii-tables.json`)
 * and DERIVES its credential verifiers from `lib/`. That instrument travels
 * to every rule-set tree by copy (`npm run patch:fleet-rls-ruleset`).
 *
 * Shipping an instrument into 37 trees is not the same as 37 trees
 * measuring. A copy can carry the gate and still be blind: no rule set (the
 * gate fails closed with "the result is UNKNOWN"), a rule set measured from
 * a different database, a copy of the gate that predates the rule set
 * entirely, or a tree with no `node_modules` and therefore no TypeScript
 * compiler to derive the verifiers with. Each of those is a copy whose
 * routes nobody can judge — the same blind spot the cron-auth sweep found in
 * session 54 and the RLS sweep found in session 57.
 *
 * So the question this sweep answers is not "does the canonical tree pass?"
 * It is: **for every tree in the family, can the gate run, and what does it
 * say?** A tree that cannot run is reported as a finding with the reason
 * named, because a copy that cannot measure is a copy nobody reviews.
 *
 * WHAT IT CHECKS
 *
 *   missing-rule-set       the copy has no `scripts/pii-tables.json`, so the
 *                           gate has no population and fails closed
 *   missing-pii-schema     the copy has no `scripts/pii-schema.mjs`, so the
 *                           gate cannot even be imported
 *   stale-rule-set         the copy's rule set differs from the canonical's
 *                           — it may be measuring an older schema
 *   rule-set-other-project the copy's rule set was measured from a different
 *                           Supabase project than the canonical's
 *   no-typescript          the copy has no `node_modules`, so the gate cannot
 *                           derive the credential verifiers
 *   gate-findings          the copy's gate reports a finding
 *
 * A tree with no `node_modules` is ALSO a tree that cannot build, so it is
 * reported as a NOTE with its count — not a finding. A finding there would
 * be a permanent red that teaches the reader to ignore the sweep.
 *
 * Usage:
 *   node scripts/audit-fleet-public-pii.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { ruleSetTrees } from "./fleet-ruleset-trees.mjs";

const FLEET_ROOT = process.env.OMNI_FLEET_ROOT || join(process.env.HOME, "Desktop", "Clients");
const CANONICAL = process.cwd();

const PII_RULE_SET = join("scripts", "pii-tables.json");
const PII_SCHEMA = join("scripts", "pii-schema.mjs");
const PII_GATE = join("scripts", "audit-public-pii.mjs");

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function sameContent(a, b) {
  try {
    return readFileSync(a, "utf8") === readFileSync(b, "utf8");
  } catch {
    return false;
  }
}

const canonicalRuleSet = readJson(join(CANONICAL, PII_RULE_SET));
if (!canonicalRuleSet) {
  console.error(
    "[fleet-pii] the canonical rule set could not be read — the result is UNKNOWN. " +
      "Regenerate it:  npm run refresh:pii-ruleset",
  );
  process.exit(2);
}

const trees = ruleSetTrees(FLEET_ROOT).filter((t) => t !== CANONICAL);

const findings = [];
const notes = [];
let measured = 0;
let clean = 0;

for (const tree of trees) {
  const name = relative(FLEET_ROOT, tree);
  const treeFindings = [];

  if (!existsSync(join(tree, PII_GATE))) {
    treeFindings.push({
      rule: "missing-pii-gate",
      detail: "the copy carries no `scripts/audit-public-pii.mjs` — nothing in it can ask the question",
    });
  }
  if (!existsSync(join(tree, PII_SCHEMA))) {
    treeFindings.push({
      rule: "missing-pii-schema",
      detail:
        "the copy carries no `scripts/pii-schema.mjs` — the gate cannot be imported, and the " +
        "definition of a personal column would have nowhere to live",
    });
  }
  if (!existsSync(join(tree, PII_RULE_SET))) {
    treeFindings.push({
      rule: "missing-rule-set",
      detail:
        "the copy carries no `scripts/pii-tables.json` — the gate has no population of tables " +
        "and fails closed with UNKNOWN",
    });
  } else if (!sameContent(join(tree, PII_RULE_SET), join(CANONICAL, PII_RULE_SET))) {
    const copy = readJson(join(tree, PII_RULE_SET));
    if (copy && copy.projectRef && canonicalRuleSet.projectRef && copy.projectRef !== canonicalRuleSet.projectRef) {
      treeFindings.push({
        rule: "rule-set-other-project",
        detail: `the copy's rule set was measured from project "${copy.projectRef}", the canonical's from "${canonicalRuleSet.projectRef}"`,
      });
    } else {
      treeFindings.push({
        rule: "stale-rule-set",
        detail:
          "the copy's rule set differs from the canonical's — it may be describing an older schema",
      });
    }
  }

  if (!existsSync(join(tree, "node_modules"))) {
    notes.push(`${name} — no node_modules, so the tree cannot build either`);
    findings.push(...treeFindings.map((f) => ({ ...f, tree: name })));
    continue;
  }

  if (treeFindings.length) {
    findings.push(...treeFindings.map((f) => ({ ...f, tree: name })));
    continue;
  }

  // Run the copy's OWN gate. Not the canonical's — the copy's routes are
  // what the copy's gate has to be able to judge.
  measured += 1;
  let out = "";
  let code = 0;
  try {
    out = execFileSync("node", [PII_GATE], {
      cwd: tree,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    code = err.status || 1;
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  if (code !== 0) {
    findings.push({
      rule: "gate-could-not-measure",
      tree: name,
      detail:
        `the copy's gate exited ${code} — it could not measure its routes:\n` +
        out
          .split("\n")
          .filter(Boolean)
          .slice(-4)
          .map((l) => `      ${l}`)
          .join("\n"),
    });
    continue;
  }
  const m = out.match(/(\d+) findings? across (\d+) rules?/);
  const count = m ? Number(m[1]) : null;
  if (count === null) {
    findings.push({
      rule: "gate-unreadable-output",
      tree: name,
      detail: "the copy's gate printed no finding count — the sweep cannot read its answer",
    });
    continue;
  }
  if (count > 0) {
    findings.push({
      rule: "gate-findings",
      tree: name,
      detail: `the copy's gate reports ${count} finding(s) — see the gate's own output for the file, table and column`,
    });
    continue;
  }
  clean += 1;
}

console.log(
  `[fleet-pii] ${trees.length} tree(s) in the family; ${measured} carry a runnable gate, ` +
    `${clean} measured clean.`,
);
if (notes.length) {
  console.log(`[fleet-pii] ${notes.length} tree(s) could not be measured at all:`);
  for (const n of notes) console.log(`  note  ${n}`);
}
console.log(
  "[fleet-pii] A tree that cannot measure is a tree nobody reviews. Carry the instrument with " +
    "npm run patch:fleet-rls-ruleset, and give a tree on another Supabase project its own rule " +
    "set:  node scripts/refresh-pii-ruleset.mjs",
);

if (!findings.length) {
  console.log("[fleet-pii] 0 findings — every copy that can measure itself does.");
  process.exit(0);
}

for (const f of findings) {
  console.log(`  [${f.rule}] ${f.tree}: ${f.detail}`);
}
console.log(`\n[fleet-pii] ${findings.length} finding(s) across the fleet.`);
process.exit(1);
