#!/usr/bin/env node
/**
 * Gate: does the RLS rule set still describe the live schema?
 *
 * WHY THIS EXISTS
 *
 * `scripts/anon-locked-tables.json` is the RULE SET of `npm run audit:rls`:
 * the list of tables the gate is able to judge. The gate fails closed when
 * that list is missing, stale or empty — but it cannot know that a table
 * was ADDED to the database after the rule set was written. A table the
 * rule set has never heard of is invisible to the gate, so a route that
 * reads it with the anon key is not reported: the gate answers 200 with an
 * empty array for exactly the tables it does not know about, and reports
 * "0 findings" over the code that touches them.
 *
 * That is not hypothetical. The rule set was generated on 2026-10-31 and
 * listed 290 tables; the live schema now has 304. Fourteen tables —
 * `ltb_booking_*`, `ltb_studio_*` and `mafi_facebook_posts` — had been
 * added and were in NO rule, so no copy of this gate, in this repo or in
 * any of the 30 fleet copies that carry it, could see a defect in them.
 * The same shape as the row-count rule set that was missing 136 locked
 * tables: the gate was not failing, it was checking a rule set that was
 * missing part of the truth.
 *
 * WHAT IT CHECKS
 *
 *   schema-table-not-in-ruleset  A table the LIVE schema has and the rule
 *                                set does not. The gate cannot classify it,
 *                                so it cannot judge code that touches it.
 *                                THIS IS THE FINDING THAT MATTERS.
 *
 *   ruleset-table-not-in-schema  A table the rule set lists and the live
 *                                schema no longer has. A stale entry; the
 *                                rule set is describing a schema that is
 *                                not there.
 *
 *   ruleset-table-misclassified  (--deep only) A table the rule set
 *                                classifies as locked that the anon key can
 *                                actually read, or vice versa — i.e. a
 *                                POLICY changed. A policy change is
 *                                invisible to a table-name comparison.
 *
 * FAIL CLOSED
 *
 * If the schema cannot be fetched, the credential is rejected, or the rule
 * set cannot be read, this gate exits 2 with "the result is UNKNOWN". A
 * gate that cannot measure must not report a clean result: "0 findings"
 * for a check that never ran is the exact failure this repo has now paid
 * for three times.
 *
 * Usage:
 *   node scripts/audit-rls-schema-drift.mjs           # table-set drift
 *   node scripts/audit-rls-schema-drift.mjs --deep    # + re-probe policy
 *
 * Requires the service role key (the OpenAPI spec endpoint is
 * service-role-only). The anon key cannot read the schema listing, and a
 * gate that silently fell back to a lesser credential would be measuring a
 * different schema than the one production serves.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEEP = process.argv.includes("--deep");

const RULE_SET =
  process.env.OMNI_RLS_RULE_SET ||
  join(process.cwd(), "scripts", "anon-locked-tables.json");

function loadEnv(file) {
  const out = {};
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function unknown(message, detail) {
  console.error(`[rls-drift] ${message}`);
  if (detail) console.error(`[rls-drift]   ${detail}`);
  console.error(
    "[rls-drift] The result is UNKNOWN — this gate did not run. Do not read this as a clean result.",
  );
  process.exit(2);
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

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
    "regenerate it:  node scripts/probe-anon-rls.mjs --write",
  );

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
const liveTables = Object.keys(defs)
  .filter((t) => !t.startsWith("+"))
  .sort();

const findings = [];
const unknownTables = liveTables.filter((t) => !snapshotTables.has(t));
const staleTables = [...snapshotTables].filter((t) => !liveTables.includes(t));

for (const t of unknownTables) {
  findings.push({
    rule: "schema-table-not-in-ruleset",
    detail:
      `the live schema has "${t}" and the rule set does not — ` +
      `npm run audit:rls cannot classify it, so it cannot judge code that reads it`,
  });
}
for (const t of staleTables) {
  findings.push({
    rule: "ruleset-table-not-in-schema",
    detail: `the rule set lists "${t}" and the live schema no longer has it`,
  });
}

// --- (--deep) policy drift -------------------------------------------------
//
// A table-name comparison cannot see a POLICY change: a table can stay
// exactly where it is and change from anon-readable to locked, and the
// rule set would then describe a table the anon key cannot see as one it
// can. The measurement for that is the permission probe itself, so the
// deep mode DELEGATES to it rather than re-implementing it here: the probe
// is the canonical measurement, and a second implementation of it is a
// second thing that can drift.
if (DEEP && !unknownTables.length) {
  const { execFileSync } = await import("node:child_process");
  let probe;
  try {
    const out = execFileSync(
      process.execPath,
      [join(process.cwd(), "scripts", "probe-anon-rls.mjs"), "--json"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    probe = JSON.parse(out);
  } catch (err) {
    unknown(
      "the permission probe could not be run, so the classifications could not be re-checked.",
      String(err && err.message),
    );
  }
  const lockedNow = new Set([...(probe.locked || []), ...(probe.indeterminate || [])]);
  const publicNow = new Set(probe.public || []);
  const lockedBefore = new Set([
    ...(ruleSet.locked || []),
    ...(ruleSet.indeterminate || []),
  ]);
  const publicBefore = new Set(ruleSet.anonReadable || []);

  for (const t of liveTables) {
    const wasLocked = lockedBefore.has(t);
    const wasPublic = publicBefore.has(t);
    const isLocked = lockedNow.has(t);
    const isPublic = publicNow.has(t);
    if (wasLocked && isPublic) {
      findings.push({
        rule: "ruleset-table-misclassified",
        detail: `"${t}" — the rule set says locked, the anon key can now READ it (its policy changed)`,
      });
    } else if (wasPublic && isLocked) {
      findings.push({
        rule: "ruleset-table-misclassified",
        detail: `"${t}" — the rule set says anon-readable, the anon key can no longer read it (its policy changed)`,
      });
    } else if (!wasLocked && !wasPublic) {
      findings.push({
        rule: "ruleset-table-unclassified",
        detail: `"${t}" is in the schema but in no classification of the rule set`,
      });
    }
  }
}

const byRule = findings.reduce((acc, f) => {
  acc[f.rule] = (acc[f.rule] || 0) + 1;
  return acc;
}, {});

console.log(
  `[rls-drift] live schema: ${liveTables.length} table(s); rule set: ${snapshotTables.size} ` +
    `(generated ${ruleSet.generatedAt || "unknown"})`,
);

if (!findings.length) {
  console.log(
    "[rls-drift] 0 findings — the rule set covers the live schema" +
      (DEEP ? ", and every classification still holds." : "."),
  );
  console.log(
    "[rls-drift] (This checked the table SET only. Run with --deep to re-probe each policy.)",
  );
  process.exit(0);
}

for (const f of findings) {
  console.log(`  [${f.rule}] ${f.detail}`);
}
console.log(
  `\n[rls-drift] ${findings.length} finding(s): ` +
    Object.entries(byRule)
      .map(([r, n]) => `${n} ${r}`)
      .join(", "),
);
console.log(
  "[rls-drift] Regenerate and re-sync the rule set:\n" +
    "           node scripts/probe-anon-rls.mjs --write\n" +
    "           npm run patch:fleet-rls-ruleset",
);
process.exit(1);
