# AIS Content Studio receiver release candidate

Prepared 2026-11-01. This manifest is local verification evidence, not a deployment or publishing receipt.

## Scope

- Read-only `GET /api/reporting/ais-empire/content-studio?month=YYYY-MM`.
- Existing service authentication plus independently verified immutable owner, MFA and recovery restrictions.
- One bounded, atomic, six-week Denver calendar snapshot. No account, owner, arbitrary SQL or pagination override.
- Exact six approved Instagram/Facebook destinations; Lead Franchise reads its isolated connection and post tables. Missing schema or partial/malformed data returns an explicit failure, never a partial successful calendar.
- DTO v1 exposes only account display state, safe image URLs, ordered carousel slides, captions and scheduling status. Legacy Instagram worker enablement remains unknown rather than inferred from connectivity.
- Existing portfolio analytics excludes the new private `/crm` route family.
- Host-only development checks are explicitly loopback-bound. No provider tokens, service secrets or database configuration are returned to browsers.

## Source preservation

Baseline production: `dpl_Dvfz54LF7evY9NAk8aXAgFM5bXuC`, source commit `70ab7bb19324eef9808aba29c988815d619e1b0f`.

Vercel source-file inventory contained **1,422** files. **1,418** source hashes matched this Git baseline exactly; no tracked-file hash differed. The following **four uploaded, untracked, non-runtime artifacts** are not in the release checkout and are explicitly excluded, not counted as preserved source:

- `CLAUDE.md.bak`
- `prompts/interlinked-2026-07-27/free-hero.md`
- `prompts/interlinked-2026-07-27/outline.md`
- `prompts/interlinked-2026-07-27/premium-hero.md`

Production identity and alias must be checked again immediately before release. Do not deploy over a newer baseline. The main release operator owns Federation resolution, lease, receiver-first deployment and Git reconciliation.

## Narrow security change

Add exact `sharp@0.35.5`; retain `next@14.2.35` and the existing React versions. The required sharp WASM dependency raises `@emnapi/runtime` to 1.11.3; no other existing dependency version changed. The installed native image stack reports libheif 1.23.5 and librsvg 2.63.2. Linux x64 lock entries resolve sharp 0.35.5 and libvips package 1.3.4.

This follows the [official SVG workaround](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw). [Vercel documents platform-wide AVIF mitigation](https://vercel.com/blog/reproducing-disclosing-and-fixing-the-libheif-vulnerability-with-hacktron-and-the-maintainers). Windows-only conditions do not describe the Vercel Linux deployment. This is not a claim that all baseline vulnerabilities are fixed: npm audit still reports 33 aggregate findings (19 moderate, 13 high, 1 critical Next package aggregation). Sharp has no audit finding. No exploit was created or executed, and no production compromise is asserted.

## Verification

- Node 24.19.0 full TypeScript check and production build: passed; 246 static pages generated.
- All CJS regression tests: 159 passed, zero failed or skipped.
- Publish-state, RLS, cron authentication, route structure, public PII and mobile audits: zero findings.
- Strict TLS with verified CA to the real approved Postgres pooler: passed; both isolated Lead Franchise tables present after the separately approved migration.
- Actual loopback HTTP receiver: missing service credential 401; valid service credential plus invalid session 401.
- Main's existing-owner browser exercised AIS -> local BFF -> real local receiver -> durable records before the dependency patch: 396 grid records, 360 in November, inline media/caption navigation working. Post-patch browser retest remains a release gate.
- Safe provider preflight: Resend authentication passed, configured `leadfranchise.org` sender verified and sending enabled. Zero messages sent and zero data writes by this receiver workstream.
- No new owner session was created. The optional one-use owner helper was stopped when the existing browser session worked.

## Release hygiene and remaining gates

`.env*`, `.vercel`, `node_modules`, `.next*`, tests and host-only preflight helpers are deployment-excluded. The local dev output is Git-ignored. No secret files or external dependency symlinks were added; generated tsconfig changes are not part of the patch.

Before shipping: complete post-patch browser retest, obtain the Federation lease, rerun `audit:deploy` against the final pushed source, deploy and verify this receiver before AIS, and register the capability in durable `runbook.*` memory. This receiver does not connect accounts, enable workers, change schedules or publish content.
