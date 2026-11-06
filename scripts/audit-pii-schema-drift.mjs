#!/usr/bin/env node
/**
 * Gate: does the PII rule set still describe the live schema?
 *
 * WHY THIS EXISTS
 *
 * `scripts/pii-tables.json` is the RULE SET of `npm run audit:public-pii`: the
 * list of tables that hold other people's rows, and the personal columns in
 * them. The gate fails closed when that file is missing — but it cannot know
 * that a table was ADDED to the database after the rule set was written, and a
 * table the rule set has never heard of is invisible to it. A route reading
 * such a table with the anon key is not reported: the gate is silent about
 * exactly the tables it does not know about.
 *
 * That is not hypothetical here. The rule set this gate protects was
 * generated on 2026-11-05 and describes 310 tables, of which 116 hold a
 * column that identifies a person. Before it existed, the population was six
 * hand-typed table names in the gate itself, so 72 of those 116 tables could
 * not be judged at all — and nothing said so, because the gate reported
 * "0 findings" over the code that touched them.
 *
 * WHAT IT CHECKS
 *
 *   personal-table-not-in-ruleset   The live schema has a table that holds a
 *                                  person's identity and the rule set does not
 *                                  describe it. `audit:public-pii` cannot
 *                                  classify it, so it cannot judge code that
 *                                  reads it. THIS IS THE FINDING THAT MATTERS.
 *
 *   schema-table-not-in-ruleset     The live schema has a table the rule set
 *                                  has never heard of. The rule set cannot
 *                                  even say whether it holds personal data.
 *
 *   ruleset-table-not-in-schema     The rule set describes a table the live
 *                                  schema no longer has — a stale entry, so
 *                                  the rule set is describing a database that
 *                                  is not there.
 *
 *   ruleset-column-not-in-schema    The rule set says a table has a personal
 *                                  column the live schema no longer has.
 *
 * FAIL CLOSED
 *
 * If the schema cannot be fetched, the credential is rejected, or the rule
 * set cannot be read, this exits 2 with "the result is UNKNOWN". A gate that
 * cannot measure must not report a clean result.
 *
 * Usage:
 *   node scripts/audit-pii-schema-drift.mjs
 *
 * Requires the service role key: the OpenAPI listing is service-role-only,
 * and a gate that silently fell back to a lesser credential would be
 * measuring a different schema than the one production serves.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  derivePersonalColumns,
  localSupabase,
  schemaTableNames,
} from "./pii-schema.mjs";

const RULE_SET =
  process.env.OMNI_PII_RULE_SET ||
  join(process.cwd(), "scripts", "pii-tables.json");

function unknown(message, detail) {
  console.error(`[pii-drift] ${message}`);
  if (detail) console.error(`[pii-drift]   ${detail}`);
  console.error(
    "[pii-drift] The result is UNKNOWN — this gate did not run. Do not read this as a clean result.",
  );
  process.exit(2);
}

const env = localSupabase(process.cwd());
const url = env.url;
const serviceKey = env.serviceKey;

if (!url) unknown("no Supabase URL in the local env.", "NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey)
  unknown("no service role key in the local env.", "SUPABASE_SERVICE_ROLE_KEY");
if (!existsSync(RULE_SET)) unknown("the rule set is missing.", RULE_SET);

let ruleSet;
try {
  ruleSet = JSON.parse(readFileSync(RULE_SET, "utf8"));
} catch (err) {
  unknown("the rule set could not be parsed.", String(err && err.message));
}
const snapshotTables = new Set(ruleSet.schemaTables || []);
if (!snapshotTables.size)
  unknown(
    "the rule set carries no schema table list.",
    "regenerate it:  npm run refresh:pii-ruleset",
  );

// A rule set is a measurement of ONE database. If it was measured from a
// different project than this checkout points at, every table name in it is
// about somebody else's schema, and comparing it with this database's would
// report drift that is not drift — or hide drift that is.
if (ruleSet.projectRef && env.projectRef && ruleSet.projectRef !== env.projectRef) {
  unknown(
    `the rule set was measured from project "${ruleSet.projectRef}" and this checkout points at "${env.projectRef}".`,
    "A rule set describes ONE database. Regenerate it here:  npm run refresh:pii-ruleset",
  );
}

// --- the live schema -------------------------------------------------------
const res = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: "application/openapi+json",
  },
});
if (!res.ok) {
  unknown(
    `the schema listing could not be fetched (HTTP ${res.status}).`,
    "The service role is required for the OpenAPI listing.",
  );
}
const spec = await res.json();
const defs = spec.definitions || spec.components?.schemas || {};
const liveTables = schemaTableNames(defs);
const livePersonal = derivePersonalColumns(defs);

const RULE_NAMES = [
  "personal-table-not-in-ruleset",
  "schema-table-not-in-ruleset",
  "ruleset-table-not-in-schema",
  "ruleset-column-not-in-schema",
];

const findings = [];
const rulePersonal = ruleSet.personalColumns || {};

for (const [table, cols] of livePersonal) {
  const known = rulePersonal[table];
  if (!known) {
    findings.push({
      rule: "personal-table-not-in-ruleset",
      detail:
        `the live schema's "${table}" holds ${cols.join(", ")} and the rule set does not ` +
        `describe it — npm run audit:public-pii cannot classify it, so it cannot judge code that reads it`,
    });
    continue;
  }
  for (const col of cols) {
    if (!known.includes(col)) {
      findings.push({
        rule: "ruleset-column-not-in-schema",
        detail: `"${table}" has a personal column "${col}" the rule set does not list`,
      });
    }
  }
}

for (const t of liveTables) {
  if (!snapshotTables.has(t)) {
    findings.push({
      rule: "schema-table-not-in-ruleset",
      detail:
        `the live schema has "${t}" and the rule set has never heard of it — ` +
        `the gate cannot say whether it holds personal data`,
    });
  }
}
for (const t of snapshotTables) {
  if (!liveTables.includes(t)) {
    findings.push({
      rule: "ruleset-table-not-in-schema",
      detail: `the rule set describes "${t}" and the live schema no longer has it`,
    });
  }
}

const byRule = findings.reduce((acc, f) => {
  acc[f.rule] = (acc[f.rule] || 0) + 1;
  return acc;
}, {});

console.log(
  `[pii-drift] live schema: ${liveTables.length} table(s), ${livePersonal.size} of them hold a ` +
    `column that identifies a person; rule set: ${snapshotTables.size} table(s), ` +
    `${Object.keys(rulePersonal).length} personal (generated ${ruleSet.generatedAt || "unknown"})`,
);

if (!findings.length) {
  console.log(
    `[pii-drift] 0 findings across ${RULE_NAMES.length} rule(s) — the rule set describes every ` +
      "table in the live schema that holds a person's identity.",
  );
  process.exit(0);
}

for (const f of findings) {
  console.log(`  [${f.rule}] ${f.detail}`);
}
console.log(
  `\n[pii-drift] ${findings.length} finding(s) across ${RULE_NAMES.length} rule(s): ` +
    (Object.keys(byRule).length
      ? Object.entries(byRule)
          .map(([r, n]) => `${n} ${r}`)
          .join(", ")
      : "no rule fired"),
);
console.log(
  "[pii-drift] Regenerate the rule set:\n" +
    "           npm run refresh:pii-ruleset",
);
process.exit(1);
