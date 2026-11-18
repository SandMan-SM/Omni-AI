// A stale suppression, used by tests/lint-gate.test.cjs.
//
// `no-console` is not enabled in this repo's ESLint config, so a directive
// that claims to suppress it suppresses nothing. The repo carried 31 of
// these until the lint gate reported them; this one is the fixture that
// keeps the rule honest.

/* eslint-disable-next-line no-console */
export const quiet = true;
