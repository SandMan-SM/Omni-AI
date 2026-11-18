// A deliberate lint warning, used by tests/lint-gate.test.cjs.
//
// The lint gate is only worth having if it FIRES — a rule that has never
// fired has never been tested, and the build carries it from now on. This
// file is the proof: a raw <img> is exactly the warning `next build` used
// to print on every deployment without failing anything.
//
// This fixture is never rendered and never imported. It exists so the gate
// can be exercised against a known-bad tree.

export function DeliberateLintWarning() {
  return <img src="/images/editorial/legacy-family-tree-v1.webp" alt="" />;
}
