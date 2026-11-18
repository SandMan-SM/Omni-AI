// Unit tests for the lint gate (scripts/audit-lint-warnings.mjs).
//
// The gate is armed in the BUILD CHAIN, which means it runs on every deploy.
// A gate that runs on every deploy and has never fired is an untested
// control that everybody trusts, so these tests pin the two shapes it is
// supposed to catch:
//   1. a real lint warning (the one `next build` printed for four days
//      without failing anything), and
//   2. a stale suppression (a disable comment that no longer suppresses).
//
// The fixtures live inside the repository on purpose: ESLint resolves a
// file's configuration by walking UP from the file, so a fixture outside the
// tree would inherit no rules and could never raise a finding.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = "tests/fixtures/lint-gate";

async function gate() {
  const module = await import("../scripts/audit-lint-warnings.mjs");
  return module.lintTree({ root: ROOT, dirs: [FIXTURE_DIR] });
}

test("the gate reports a deliberate lint warning", async () => {
  const report = await gate();
  const warnings = report.findings.filter((f) => f.rule === "lint-warning");
  assert.ok(warnings.length > 0, "the fixture should raise a lint warning");
  assert.ok(
    warnings.some((w) => w.detail.includes("no-img-element")),
    `expected the no-img-element warning, got: ${JSON.stringify(warnings)}`,
  );
  assert.ok(report.files > 0, "the gate must report the population it examined");
  assert.ok(report.enabledRules > 0, "the gate must report the rules it ran");
});

test("the gate reports a stale suppression", async () => {
  const report = await gate();
  const stale = report.findings.filter((f) => f.rule === "lint-unused-disable-directive");
  assert.ok(stale.length > 0, "the fixture should raise an unused-disable-directive finding");
});

test("the gate fails closed when there is no rule set to run", async () => {
  const module = await import("../scripts/audit-lint-warnings.mjs");
  await assert.rejects(
    () => module.lintTree({ root: path.join(ROOT, "does-not-exist"), dirs: ["."] }),
    /eslintrc\.json is missing/,
  );
});
