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
 * Only five files are written, and only into trees that already carry the
 * rule set or the gate:
 *
 *   scripts/anon-locked-tables.json      — the rule set
 *   scripts/audit-anon-rls.ts            — the gate that reads it
 *   scripts/audit-rls-schema-drift.mjs   — the gate that checks the rule set
 *   scripts/audit-public-pii.mjs         — the gate that checks public PII
 *   scripts/audit-sitemap-parity.ts      — the gate that compares the sitemap
 *                                         with the routes' indexability
 *   scripts/audit-live-mobile.mjs        — the gate that measures the RENDERED
 *                                         truth of a site (overflow, broken
 *                                         images, dead hrefs, dark theme)
 *
 * The third file is the DRIFT gate. The rule set is a measurement of the
 * live schema, and a measurement can go stale: a table added to the database
 * after the snapshot is invisible to every gate that reads it — in the
 * canonical tree and in every copy that carries the same file. Syncing the
 * drift gate alongside the rule set means each copy can check its own
 * snapshot against the live schema instead of trusting a date on a file.
 * It is read-only (it fetches the schema listing and compares it), so
 * adding it to a copy changes no behaviour there.
 *
 * The fourth is the PUBLIC-PII gate: the check that catches an
 * unauthenticated route carrying somebody else's identity. That defect
 * class travels BY COPY — the canonical rankings route was fixed by hand,
 * and all 32 copies kept the byte-identical pre-fix file — and a copy is
 * exactly where such a defect survives, because nobody re-reviewed it. The
 * gate is read-only (it walks the route tree and reads files), so adding
 * it to a copy changes no behaviour there either. Giving a copy the gate
 * means it can measure itself.
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
const DRIFT_GATE = join("scripts", "audit-rls-schema-drift.mjs");
const PII_GATE = join("scripts", "audit-public-pii.mjs");
const SITEMAP_GATE = join("scripts", "audit-sitemap-parity.ts");
const LIVE_MOBILE_GATE = join("scripts", "audit-live-mobile.mjs");
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
  let driftWritten = 0;
  let driftAdded = 0;
  let piiWritten = 0;
  let piiAdded = 0;
  let sitemapWritten = 0;
  let sitemapAdded = 0;
  let liveWritten = 0;
  let liveAdded = 0;

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

    const treeDrift = join(tree, DRIFT_GATE);
    if (!existsSync(treeDrift)) {
      changes.push("drift gate (added)");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, DRIFT_GATE), treeDrift);
      driftAdded += 1;
    } else if (!sameFile(treeDrift, join(CANONICAL, DRIFT_GATE))) {
      changes.push("drift gate");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, DRIFT_GATE), treeDrift);
      driftWritten += 1;
    }

    // The public-PII gate travels with the rule set: it is the check that
    // catches an unauthenticated route carrying somebody else's identity,
    // and a copy is exactly where that class of defect survives, because
    // the copy's route was never fixed by hand.
    const treePii = join(tree, PII_GATE);
    if (!existsSync(treePii)) {
      changes.push("PII gate (added)");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, PII_GATE), treePii);
      piiAdded += 1;
    } else if (!sameFile(treePii, join(CANONICAL, PII_GATE))) {
      changes.push("PII gate");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, PII_GATE), treePii);
      piiWritten += 1;
    }

    // The sitemap-parity gate travels too: it is the check that compares
    // what the site advertises with what the site actually serves, and a
    // copy's app/sitemap.ts drifts from its own app/ exactly the way the
    // canonical one did — a noindex layout de-indexing a page the sitemap
    // still advertises.
    const treeSitemap = join(tree, SITEMAP_GATE);
    if (!existsSync(treeSitemap)) {
      changes.push("sitemap gate (added)");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, SITEMAP_GATE), treeSitemap);
      sitemapAdded += 1;
    } else if (!sameFile(treeSitemap, join(CANONICAL, SITEMAP_GATE))) {
      changes.push("sitemap gate");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, SITEMAP_GATE), treeSitemap);
      sitemapWritten += 1;
    }

    // The live mobile audit is the instrument that measures a copy's RENDERED
    // truth — overflow, broken images, dead hrefs, dark theme, and the
    // sitemap's own indexability. A copy carrying an older copy of that
    // instrument measures a different site than the canonical one does: the
    // copies in the fleet were missing the dark-theme rules entirely, and
    // the canonical light-surface rule had a false positive on translucent
    // surfaces until 2026-11-03. It is read-only (it drives a browser at a
    // URL), so adding it to a copy changes no behaviour there.
    const treeLive = join(tree, LIVE_MOBILE_GATE);
    if (!existsSync(treeLive)) {
      changes.push("live mobile gate (added)");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, LIVE_MOBILE_GATE), treeLive);
      liveAdded += 1;
    } else if (!sameFile(treeLive, join(CANONICAL, LIVE_MOBILE_GATE))) {
      changes.push("live mobile gate");
      if (!DRY_RUN) copyFileSync(join(CANONICAL, LIVE_MOBILE_GATE), treeLive);
      liveWritten += 1;
    }

    if (changes.length) {      console.log(
        `  ${DRY_RUN ? "would sync" : "synced"}  ${relative(FLEET_ROOT, tree)} — ${changes.join(", ")}`,
      );
    }
  }

  console.log(
    `\n[fleet-ruleset] ${trees.length} tree(s) carry the rule set. ` +
      `${ruleSetWritten} rule set(s), ${gateWritten + gateAdded} gate(s), ` +
      `${driftWritten + driftAdded} drift gate(s), ${piiWritten + piiAdded} PII gate(s) and ` +
      `${sitemapWritten + sitemapAdded} sitemap gate(s) and ` +
      `${liveWritten + liveAdded} live mobile gate(s) ` +
      `${DRY_RUN ? "would be" : "were"} written (${gateAdded} gate(s), ${driftAdded} drift gate(s), ` +
      `${piiAdded} PII gate(s), ${sitemapAdded} sitemap gate(s) and ${liveAdded} live mobile gate(s) ` +
      `added where the tree had none).`,
  );
  console.log(
    "[fleet-ruleset] No application code was touched. A copy that reads a locked table with the " +
      "anon key still answers 200 with an empty array; the rule set only makes the gate able to SEE it.",
  );
  return 0;
}

process.exit(main());
