/**
 * TEMPORARY — a deliberate type error, committed on purpose to prove that the
 * deploy gate can see a failed Vercel build.
 *
 * The gate's `failed-build` rule had never fired, and a rule that has never
 * fired is not a rule. So it is fired on the real thing: this file makes
 * `next build` fail on Vercel, the deployment goes to ERROR, and the gate is
 * asked whether it reports the failure. The next commit deletes it and the
 * gate must go quiet again.
 */
export const buildFailureProof: number = "this is not a number";
