// Unit tests for the page-metadata gate (scripts/audit-page-metadata.mjs).
//
// The gate is armed in the BUILD CHAIN. A gate in the build chain that has
// never fired is an untested control that everybody trusts, so these tests
// pin the shapes it must catch — a page with no metadata anywhere in its
// segment chain, and a page whose own metadata literal has no description —
// and the shapes it must NOT catch: a page that inherits metadata from a
// layout, and a page whose metadata is built by a factory call.
//
// The fixtures live inside the repository on purpose: they are ordinary
// source files, and a fixture outside the tree would not be linted, typed or
// built by anything that ships.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_ROOT = path.join(ROOT, "tests/fixtures/page-metadata");

async function gate() {
  const module = await import("../scripts/audit-page-metadata.mjs");
  return module.scanPages(FIXTURE_ROOT, "app");
}

test("the gate reports a page with no metadata in its chain", async () => {
  const report = await gate();
  const missing = report.findings.filter((f) => f.rule === "page-without-metadata");
  assert.equal(missing.length, 1, `expected one page without metadata, got ${JSON.stringify(missing)}`);
  assert.ok(missing[0].file.endsWith(path.join("app", "bare", "page.tsx")));
});

test("the gate reports a metadata literal with no description", async () => {
  const report = await gate();
  const incomplete = report.findings.filter((f) => f.rule === "page-metadata-without-title-or-description");
  assert.equal(incomplete.length, 1, `expected one incomplete literal, got ${JSON.stringify(incomplete)}`);
  assert.ok(incomplete[0].file.endsWith(path.join("app", "literal", "page.tsx")));
  assert.ok(incomplete[0].detail.includes("description"));
});

test("the gate does not report a page that inherits metadata from a layout", async () => {
  const report = await gate();
  assert.ok(!report.findings.some((f) => f.file.endsWith(path.join("app", "nested", "page.tsx"))));
});

test("the gate does not report metadata built by a factory call", async () => {
  const report = await gate();
  assert.ok(!report.findings.some((f) => f.file.endsWith(path.join("app", "factory", "page.tsx"))));
});
