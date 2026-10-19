# Sitani payments backend — launch-candidate and Test evidence

## Current production recovery — October 18, 2026

The missing production payment routes were restored at approximately 06:45 UTC in deployment `dpl_2bG1ALSBuW74FGSB4hTxbtfeLi1w`, source commit `1a936664a68809453c0de7bb01214fdf81d401be`. The isolated recovery source is `/Users/janahasson/Desktop/Clients/_deploy-worktrees/sitanim-payments-recovery-20261018.r96SEz`. It preserves all seven newer sponsor/embed retirements from the superseded deployment while restoring the prior verified payment routes, dedicated modules, dependencies, packaging exclusions, and five-minute worker cron. No credentials, provider objects, database schema, or existing newsletter cron were reset.

Fresh verification: 218 payment regressions passed on Node 24.19.0, whole-repository typecheck passed, local and remote production builds generated 248 pages, and all 1,293 uploaded files hash-match the frozen commit. Canonical authenticated backend health and the actual frontend production OIDC health both return 200; unauthorized health/worker and operator customer-status calls return 401. The existing live webhook remains enabled for its exact 13 events. The dedicated database, nine Stripe prices, and verified sending/receiving domain passed read-only checks. A real platform-scheduled payment worker GET returned 200 in deployment logs; no manual worker was invoked. The three monthly checkout pages opened with the correct prices, but no real payment was made and no live financial fulfillment is claimed from these checks.

The frontend plain hamburger release is `dpl_H1TbwfDGk3PdG4mj52d9Nx3JsoXG`, commit `6540e59281ba13647f80e40a5ca58f2c9149d9f1`, source `/Users/janahasson/Desktop/Clients/_deploy-worktrees/sitanim-support-launch-20261017`. Its 79 regressions, typecheck, 77-page build, source audit, live navigation, and post-release payment health passed.

Recurrence prevention: the 40 missing/baseline canonical backend source paths were synchronized without changing the seven existing sponsor-retirement edits or three public previews. Canonical Git HEAD is still the older `4b636287`; do not deploy that old commit or discard the restored payment patch. The canonical frontend contains divergent user-owned work and was deliberately not overwritten. For either next release, resolve federation authority, inspect current deployed source and lease/changelog, and preserve the entire verified production baseline before applying a new patch.

Sanitized current reports are in `Creative/Membership/2026-10-17-support-structure/`: `backend-recovery-provenance-20261018.json`, `backend-recovery-node24-regression-20261018.json`, `backend-staged-source-audit-20261018.json`, `canonical-payments-source-sync-proof-20261018.json`, `backend-post-recovery-readonly-verification-20261018.json`, `frontend-hamburger-staged-source-audit-20261018.json`, and `hamburger-production-release-20261018.json`.

## Historical launch-candidate and Test evidence

The remaining sections below are dated prelaunch evidence. Their statements that production was disabled, undeployed, or awaiting setup are historical and are superseded by the current recovery status above. Preserve their limitations on what synthetic tests and provider acceptance establish.

Status: October 17, 2026. **Production launch candidate is not deployed or activated.** Actual local Test-mode purchases and one successful/failed monthly renewal are verified on the earlier isolated Test implementation. Six browser checkouts exercised the real Stripe listener, restricted-key reads, isolated PostgreSQL ledger/private contacts, actual Resend test-recipient acceptance, and bound confirmation UI. This is bounded historical Test evidence, not proof of current production readiness.

The current candidate has dedicated live-mode transport, fixed frontend-identity guards and a two-phase payment-ledger/central-CRM handoff. After the health-only operator authentication patch, the frozen October 16/Next 14 candidate independently passes 218 regression tests, whole-repository typecheck and a 248-page production build. Live processing remains disabled by default and additionally requires the explicitly enabled CRM gateway, dedicated database and approved provider credentials. Local synthetic verification is not actual production connectivity, messaging or payment proof; historical provider evidence remains separately identified below.

## Scope and authority

Registry authority: `omnileadsagi.com` → Vercel project `omni-ai`, team `sandman-sms-projects`, canonical codebase `Sitani Mafi/Omni AI/Website`, Vercel CLI, migrations-only. The current isolated release checkout is `_deploy-worktrees/sitanim-payments-launch-20261017`, based on verified October 16 production commit `4b6362875972f4f38b3080c540a6ad18da12b325` (deployment `dpl_ENS9eqYAWXb62idHUJmbYRkbHGQH`). All 1,260 tracked deployed source files match that commit byte-for-byte. Three deployed public email-preview assets are preserved byte-exact; local caches, Supabase CLI temp state, secrets and unrelated canonical dirty edits are excluded. Next 14.2.35 and the existing framework versions are retained. Runtime dependency changes are `pg` 8.21.0, the isolated `stripe-sitanim` 22.6.0 alias, and `@vercel/oidc` pinned 4.0.1 for per-call server request-context identity. No existing locked package version or integrity changed.

The historical Test implementation started from October 14 commit `03540cfebbc5420d7964927db432eb3076c8cd7e` in `_deploy-worktrees/sitanim-payments-backend-20261017`. That branch is divergent and must not be merged or deployed wholesale over the October 16 site. Only the approved 25 payment files were transplanted. Preserve unrelated canonical work. Resolve the registry and read five fresh changelog rows again before any later deployment or migration.

User approved the private ledger, CRM linkage and customer/admin notification workflow, with live purchases disabled until full end-to-end and policy/tax checks. Production checkout activation is not part of this build/test handoff.

## Components

- `sitanim-payments-policy.ts`: fixed Secret Imperium account `acct_1QvMSNChZyGhfmDO`, exact nine Test and nine live price IDs, approved product/amount/currency/interval/quantity rules. Ownership never comes from product names or metadata.
- `sitanim-payments-provider.ts`: dedicated Stripe SDK 22.6.0 instance, installed as `stripe-sitanim` so older consumers are not upgraded. Verifies original webhook bytes/signature and resolves native Checkout/Subscription/Invoice/Price/Customer/PaymentIntent links. Ignores unrelated products and stale failures whose newer invoice is paid. It requires a dedicated environment-matching restricted key; Test and live key configuration never fall back to one another.
- `sitanim-payments-store.ts`: curated event receipt, native financial deduplication, purchase ledger, private Test contact linkage, commercial commitments and durable notification outbox. Every transaction uses the unprivileged worker role. Live storage additionally requires explicit live/CRM enablement and uses durable CRM jobs/receipt-bound stages rather than the synthetic Test contact mirror.
- `sitanim-payments-crm.ts`: prepared, inactive production CRM adapter for the fixed `sitanim` business. It requires an existing transaction, validates the exact source order and tenant, resolves provider binding then normalized same-business email, and merges only its namespaced payment metadata. It preserves names, source linkage and marketing consent. No runtime imports or grants activate this adapter.
- `sitanim-payments-{transport,central-http,central-runtime,gateway}.ts`: two-phase live CRM handoff, verified with isolated synthetic HTTP/SQL fixtures. The fixed central URL accepts only order/event/hash references authenticated by the Omni production project's self-OIDC; it independently re-reads durable native-ledger proof and its monotonic ledger revision. Native financial/customer bindings and exact event/hash receipts make central retries idempotent. Older same-second retries cannot overwrite newer CRM state. CRM updates preserve unrelated metadata/consent. Suppression checks independently bind the recipient to a pinned, actively claimed outbox payload; callers cannot supply arbitrary recipient addresses. The central pool and dedicated payment-store pool remain distinct.
- `sitanim-payments-notifications.ts`: transactional confirmation/status messages, no marketing enrollment. Test transport accepts only official Resend test recipients; the dedicated live transport is separate. Root's two approved real-mailbox setup canaries used that application transport and reached provider-reported DELIVERED, but were not production payment-workflow notifications. Sponsor payment leaves onboarding and VIP access pending; services remain separately scoped. Subscription status/cancellation notices are not new-charge receipts.
- `sitanim-payments-http.ts`: bounded body, signature-first processing, authenticated operator endpoints and one-attempt queue processing. A paid record plus missing/rejected/ambiguous required notifications returns an explicit 503. Claims occur one at a time, at most two per request; provider acceptance must be persisted before it counts.
- `sitanim-payments-runtime.ts` and `sitanim-payments-auth.ts`: lazy dedicated credentials, one-connection strict-TLS pool, disabled by default. Live mode requires explicit live enablement plus a production runtime/deployment and CRM gateway; Test mode is forbidden in production. The development bridge requires exact HTTP loopback port 3019. Frontend health/customer-status calls require verified identity for the fixed Sitani production project, except the existing dedicated operator may use GET health only for the no-write backend-first gate. Central gateway calls require the distinct Omni self-project identity; worker/admin roles remain distinct. The kill switch is checked even when handlers are cached. No legacy key/database fallback. These seams do not imply production activation or passed release gates.

## Current dedicated payments database — source and application state

The root operator applied the dedicated-project initialization in Supabase project `tzwxbbpsvmcaxhnlxmjj` under federation lease 840. Actual remote migration version: **20261018001211**, name `sitanim_payments_init`. Source is `payments-project/supabase/migrations/20261018001211_sitanim_payments_init.sql`; SHA-256 **976bf3af1fe9cc340661fd841a9b33e7c3451b3eecde5ff2a453cd8c88dc0ccf**. Filename alignment changed no SQL bytes. Do not replay shared-project migration history into this dedicated project.

Root's post-apply inspection reports seven empty private tables with FORCE RLS, no PUBLIC/anon/authenticated access, an unprivileged NOLOGIN worker, and zero security-advisor findings. This establishes the empty schema, not application login connectivity or production readiness. The planned login is NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS with connection limit four and worker membership ADMIN false, INHERIT false, SET true. Login creation, whole-project inherited privileges (including extension capabilities), strict-TLS connectivity and end-to-end gateway proof remain separate gates.

Root applied the shared central CRM gateway migration as actual remote version **20261017182810**. Source is `supabase/migrations/20261017182810_sitanim_payment_gateway.sql`; SHA-256 **90609ace5a55a0cf4eab8859631aabb43a6d2c146ee3a00338ed77dc5c5e73ca**. It creates only private binding/receipt tables in the central project; it does not place a broad central credential into the payment store or apply global PUBLIC/extension grant changes. The receiver uses the existing trusted central service credential boundary, so sharing one deployment is not infrastructure-level credential isolation. Applied schema alone does not establish deployed gateway identity or real contact/message proof.

Root reports applying the final additive dedicated recovery migration as actual remote version **20261018004057**. Source is `payments-project/supabase/migrations/20261018004057_sitanim_payment_recovery.sql`, SHA-256 **4b3a3e199d1620a0244f535c5c33a99ee4188cf7a35cb045cc1673594d307cb9**. It adds exact required CRM event/hash authority, monotonic order/job revisions and durable obsolete-notice supersession. Filename/test-reference alignment changed no SQL bytes; the init and central migration bytes remain unchanged. Root owns remote read-back/privilege proof and production activation. No remote migration was applied by the independent verification step.

`scripts/sitanim-payments-live-bootstrap.mjs` prepares random local-only credential material and SCRAM-verifier-only review SQL in a fixed external mode-0700 directory/mode-0600 JSON artifact, refuses overwrites, never prints values and performs no SQL or network call. The helper is excluded from deployment uploads. Prepared material is not evidence that a database login or provider credential exists.

## Historical private schema in the shared project

Project: `odvxtychuxxsudfpcqqs`. Migration applied through Supabase MCP under federation DB lease 835; recorded remote version **20261017144203**, name `sitanim_payments`. The file was first generated by the Supabase CLI, then aligned to the actual applied remote version to prevent a future push from replaying it as a different migration.

Source file: `supabase/migrations/20261017144203_sitanim_payments.sql`.
SHA-256: `bb8fbc7e712ec46f34de0f11530ffec356a49bffe4cd74dad4df7cc994507d5c`.

Six tables: `events`, `orders`, `commitments`, `outbox`, `test_contacts`, `test_suppressions`, all in the unexposed `sitanim_payments` schema. Each has RLS and FORCE RLS plus a worker policy. `PUBLIC`, `anon`, `authenticated` and `service_role` have no schema/table grants. Worker `sitanim_payments_worker` is NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE and NOBYPASSRLS. No login credential was created. All remote payment/event/outbox tables are empty; no customer data or messages were written by this migration.

Schema-specific security advisor findings: zero. The shared project already reports unrelated findings; this is not a claim that the entire project has a clean security audit.

Test payments always use a private synthetic contact mirror, never the real public CRM. Production CRM remains disabled, ungranted and unconnected. A future dedicated login should receive only the worker membership needed for this private schema. Do not give the application a broad Postgres administrator credential or public browser service key.

## Routes and configuration

| Route | Method | Boundary |
| --- | --- | --- |
| `/api/inbound/sitanim/payments` | POST | Stripe signature, exact account/environment/native graph |
| `/api/inbound/sitanim/payments` | GET | Fixed production frontend identity or existing dedicated operator in production-live; exact development Test loopback operator bridge; no-write provider/database readiness only |
| `/api/internal/sitanim/payments/status?id=<order UUID>` | GET | Operator bearer token; curated private state, not a customer-facing success page |
| `/api/internal/sitanim/payments/customer-status?session_id=<native session>&reference=<random>` | GET | Fixed production frontend identity, or exact development Test loopback operator bridge; native session/reference/catalog validation, PII-free read-only status |
| `/api/internal/sitanim/payments/worker` | GET/POST | GET requires existing platform CRON_SECRET; POST requires dedicated payment operator; bounded durable-outbox attempts |
| `/api/internal/sitanim/payments/crm-sync` | GET/POST | Fixed Omni production self-OIDC; readiness or reference-only native-ledger-bound CRM synchronization |
| `/api/internal/sitanim/payments/crm-suppression` | POST | Fixed Omni production self-OIDC; only recipient derived from pinned outbox proof |

For the backend-first release gate, the existing dedicated operator bearer may call **GET health only** in production-live before the frontend is deployed. It exposes the same PII-free provider/account, private-store, and authenticated central-readiness projection; it performs no payment, CRM, notification, or configuration write. A bad/missing operator token remains unauthorized. Operator authority does not extend to customer checkout status: that still requires the fixed frontend OIDC identity. POST worker and GET platform-cron boundaries are unchanged, and no new credential is introduced.

Server-only configuration names:

```
SITANIM_PAYMENTS_BACKEND_ENABLED=false
SITANIM_PAYMENTS_ENVIRONMENT=test
SITANIM_PAYMENTS_DATABASE_URL
SITANIM_PAYMENTS_TEST_DATABASE_CA_CERT
SITANIM_PAYMENTS_OPERATOR_TOKEN
SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY
SITANIM_PAYMENTS_STRIPE_TEST_WEBHOOK_SECRET
SITANIM_PAYMENTS_RESEND_KEY
SITANIM_PAYMENTS_EMAIL_FROM
SITANIM_PAYMENTS_TEST_OWNER_EMAIL
SITANIM_PAYMENTS_REPLY_TO
SITANIM_PAYMENTS_LIVE_ENABLED=false
SITANIM_PAYMENTS_LIVE_CHECKOUT_ENABLED=false
SITANIM_PAYMENTS_CRM_GATEWAY_ENABLED=false
SITANIM_PAYMENTS_LIVE_DATABASE_URL
SITANIM_PAYMENTS_LIVE_DATABASE_CA_CERT
SITANIM_PAYMENTS_STRIPE_LIVE_RESTRICTED_KEY
SITANIM_PAYMENTS_STRIPE_LIVE_WEBHOOK_SECRET
SITANIM_PAYMENTS_LIVE_RESEND_KEY
SITANIM_PAYMENTS_LIVE_BUSINESS_ID
SITANIM_PAYMENTS_OWNER_EMAIL
CRON_SECRET
```

Do not place values in source, chat, logs or committed environment files. Prefer dedicated restricted Stripe keys and sensitive platform environment storage. The Test restricted key must allow the account/payment objects this adapter reads; it must not allow charges, transfers or payouts. Test customers and owner recipients must be approved official Resend test addresses; there is no silent recipient redirection. The sender domain `sitanimafi.com` is verified and sending-enabled. The application's dedicated, domain-restricted sending-only key passed an actual official-test-inbox canary and the required payment/status sends; account/domain API reads were rejected. Acceptance and official test-inbox delivery simulations do not establish delivery to a real human mailbox.

The webhook endpoint and automatic durable worker schedule are not registered/deployed. A manual authenticated worker route alone is not a complete production scheduling arrangement. Stripe retries on a non-2xx response help recover pending events, but do not replace an audited ongoing worker/reconciliation process.

### Root-operated production provider preflight — separate from local regressions

Root reports the dedicated live restricted Stripe key passed an actual read-only native catalog smoke for all nine approved offers and was stored as a sensitive production value. A separate `sitanimafi.com`-only Sending Access key was also captured privately and stored sensitively. Root's two explicitly approved Gmail setup canaries passed the actual application transport and provider-reported DELIVERED. These messages prove that bounded sender setup path, not a paid webhook/CRM/required-notification workflow or a human-read receipt.

Root's newer domain read verifies sending DKIM/SPF and inbound MX. The native human inbox `support@sitanimafi.com` was created without forwarding, an agent or an inbound-action webhook. Actual owner reply/inbound round-trip proof remains pending. No provider mutation, real send, mailbox-content read or deployment occurred during the independent local verification. Do not broaden the application sender key to inbox/account management access. Local-only live helpers are excluded by `scripts/sitanim-payments-live-*` in `.vercelignore`.

### Worker cron preflight — not activated

Scoped read-only CLI metadata confirms the existing team is on active Pro. The actual remote project currently has only the enabled newsletter cron `/api/cron/newsletter?action=publish-public` at `5 14 * * *` UTC, with no modified/undeployed cron entries. Local `vercel.json` preserves it and proposes the payment worker at `1-59/5 * * * *` (minutes 1, 6, …, 56), avoiding the newsletter's minute 5. The installed Vercel CLI pure validator accepts both expressions. The current Pro allowance supports this interval without a plan upgrade; normal Function usage billing still applies. [Official limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Vercel scheduled requests are GETs carrying the existing platform `CRON_SECRET`. Do not read, rotate or replace that existing value for this integration. Manual payment worker POSTs accept only the dedicated payment operator token; neither role is accepted as frontend OIDC. The payment-specific generated cron material is not a runtime fallback and does not authorize scheduled GETs. Cron delivery is best effort, can miss/duplicate runs, and failed invocations are not automatically retried; durable DB leases, idempotent retries, reconciliation and operational alerting remain mandatory. [Official cron authentication/delivery guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs). This preflight did not activate or run a remote worker.

## Delivery and fulfillment semantics

Checkout and its initial invoice share a native financial identity and one pair of initial notification keys. Renewals create invoice-specific records. Lifecycle updates do not invent new purchases. Replays are idempotent; stale updates cannot regress a newer paid/canceled state. Changed payloads under the same event ID conflict, and retries consume the first curated durable snapshot.

Notification payloads are pinned before sending; retries retain recipient/content/idempotency key. Accepted customer mail is not resent because owner mail failed. Suppression lookup errors are failures, not successful suppression. Provider acceptance without a saved receipt is ambiguous and remains pending. After a conservative 23-hour boundary, ambiguous/crashed attempts require reconciliation rather than automatic resend after the provider forgets its key. No state asserts delivery just from acceptance. Newer financial/subscription state durably supersedes obsolete unsent notices, retaining audit rows without inventing acceptance; already externally sent messages cannot be withdrawn.

CRM jobs retry fairly by due time/attempt count and stop after eight attempts or a permanent authenticated error, preserving explicit `reconcile` state instead of starving later orders. A manual reconciliation procedure must inspect native payment state, exact durable event/hash, central receipt and provider acceptance before retrying or correcting a job. Never silently requeue a permanent/exhausted or ambiguous notification with a fresh idempotency key. Required notices and customer confirmation depend on the exact current event/hash/receipt, not equal-second timestamps. A new required event resets internal fulfillment until its exact receipt and all active notices are accepted; superseded rows are not active requirements.

Sponsor commitments record six months, twelve months or lifetime, but do not begin finite terms or grant access until approved onboarding. Both accepted payment messages still leave sponsor fulfillment pending. Membership `complete` means this test's required recording/linkage/notification stages, not professional services, marketing consent or an investment return. The HTTP response never asserts sponsor placement or VIP fulfillment.

## Current frozen launch checkout verification — local gates passed

The October 16/Next 14 candidate independently passed **218 tests, zero failures and zero skips**, on Node 24.19.0 and PostgreSQL 18.3, whole-repository `tsc --noEmit --incremental false`, `git diff --check`, and a complete production build generating **248/248 pages**. Next 14.2.35 and the baseline tsconfig remain unchanged. The build used a separate `.next-sitanim-launch-check` directory, nonfunctional placeholders and disabled payment flags; Next's generated types include was removed afterward. No real provider credential, environment pull, deployment or remote database write was used. Existing unrelated image/Browserslist/runtime warnings did not fail the build and were not expanded into unrelated edits. This supersedes the earlier 216-test build checkpoint with the operator GET-health-only patch included.

| Layer | Tests | Boundary |
| --- | ---: | --- |
| Policy/catalog | 18 | Pure validation |
| Native provider graph/signature | 54 | Synthetic reads and real SDK HMAC checks |
| Transactional notifications | 17 | Synthetic provider responses, no messages |
| CRM query adapter | 11 | Query mocks |
| HTTP unit/failure semantics | 19 | Direct Request fixtures |
| Customer confirmation | 7 | Bound status contract fixtures |
| Production mode/identity guards | 12 | Fixed identities, health-only operator authority, cron separation and loopback boundaries |
| Private ledger/outbox SQL | 35 | Marked disposable PostgreSQL only |
| Loopback HTTP/SQL | 14 | All nine offers; synthetic provider acceptance |
| Central CRM/gateway SQL | 14 | Synthetic public-table fixtures only |
| Two-phase HTTP/ledger/CRM | 11 | Separate local stores, signed synthetic identities and no-write operator health |
| Central transport | 6 | Fixed destination and safe error/retry classification |

The SQL suites use five exact marked disposable loopback databases and never touch the durable actual-provider database or remote projects. New/returning-contact, central outage/lost-response, suppression failure and required-owner rejection fixtures pass. Independent review initially found retry starvation, obsolete notice eligibility and timestamp-only CRM receipt gating at a 197-test checkpoint. Final regressions cover fair/bounded reconciliation, durable supersession including claimed notices, exact event/hash receipts, duplicate-paid-event completion reset, and out-of-order equal-second CRM retries using monotonic ledger revisions. All four findings are resolved in the tested source. Sanitized evidence is `Creative/Membership/2026-10-17-support-structure/payments-launch-independent-review.json`.

This proves local compilation and the synthetic regression paths, not the complete production chain. Strict-TLS live connectivity, deployed identity/webhook/cron behavior, actual CRM linkage, accepted customer/owner messages and visible production confirmation remain release gates.

## Historical source-worktree verification — before current-baseline transplant

Node 24.22.0, PostgreSQL 18.3, 178 automated regression tests on the prior source worktree, including the dedicated production-mode/auth guard patch. These results must be rerun against the October 16 launch baseline after current implementation changes finish:

| Layer | Tests | Provider boundary |
| --- | ---: | --- |
| Policy/catalog | 18 | Pure validation |
| Native provider graph/signature | 51 | Injected synthetic provider reads; real SDK HMAC checks |
| Transactional notifications | 17 | Injected provider responses, no messages |
| Production CRM adapter contract | 11 | Query mocks |
| HTTP/auth/failure semantics | 19 | Direct Request/dependency fixtures |
| Private ledger/outbox/CRM integration | 24 | Real isolated PostgreSQL |
| Signed loopback HTTP → SQL → private CRM → outbox | 14 | All nine offers; synthetic Stripe hydration/Resend acceptance |
| Prepared production CRM SQL adapter | 9 | Real PostgreSQL with synthetic public-table fixtures only |
| Customer-bound confirmation status | 7 | Native-reference/ledger contract fixtures and disabled-runtime checks |
| Production mode/identity guards | 8 | Fixed OIDC identity, environment isolation and loopback boundary fixtures |

All historical source-worktree tests pass with no skips. Its whole-repository typecheck and production build (246 static pages) pass. This is not yet the new launch checkout's result. The build uses nonfunctional placeholders/loopback provider URLs, not production credentials. It proves compilation, not connectivity. Existing unrelated image/Browserslist/runtime warnings were not expanded into unrelated edits.

The actual built Next routes were started on loopback with the backend flag unset. All four tested route/method paths returned the expected explicit `503 payments_backend_disabled`, with no database or messaging side effects. No production API deployment occurred.

Local SQL suites accept only exact loopback host/port/database names plus a database marker `sitanim_payments.qa_cluster=disposable-sitanim-payments-20261017` before resetting their synthetic schema. They never fall back to `POSTGRES_URL` or `DATABASE_URL`. The dedicated scratch cluster is separate from Supabase. Its test-only persisted data can be kept while the server is stopped.

## Actual local provider verification — October 17

The six membership choices ($1/$20/$50 monthly and $11/$220/$550 annually) each passed an actual browser checkout through the fixed local frontend API, genuine signed Stripe CLI events, native provider graph verification, durable ledger, private Test contact linkage, customer/owner acceptance receipts and the confirmed UI. Repeated emails linked to existing private contacts; six purchases produced three contacts, not six. Initial Checkout/invoice events did not duplicate financial orders or paid receipts.

The application uses a dedicated Test restricted key with payment-object read permissions plus the separately approved `stripecli_session_write` Debugging Tools permission. It cannot charge, refund or pay out through that key. The sender key is sending-only and restricted to `sitanimafi.com`; its actual send to an official Resend test inbox succeeded, while account/domain API reads were rejected. Values are stored only in a mode-0600 external configuration inside a mode-0700 directory, never in source or uploaded env files.

Actual Test cancellation through a customer-bound Stripe portal session scheduled cancellation at the native period end, preserved the original paid order, and produced separate accepted status notices. The shareable portal's email-code login was not tested with a real mailbox. A deliberate official declined-card attempt remained on Stripe's explicit error screen and created no new ledger/contact/outbox record; retrying the same checkout with the success test card completed normally. This is initial-card-decline coverage, not a failed future renewal.

One extra $1 Test purchase verified required-owner-notification failure and recovery. An owned, fixed-scope suppression row in the isolated DB blocked only the approved Test owner. The real payment and customer acceptance persisted, fulfillment stayed pending, and the browser explicitly showed “Test workflow needs attention” with the owner stage not verified. The owned temporary row was removed without modifying preexisting suppressions; after the persisted retry time, the bounded worker accepted exactly one owner message. The customer retained one accepted message/one attempt, owner attempts became two, and the browser confirmed only after recovery. Final local evidence: seven paid/complete financial orders, four private contacts, 22 native events, 16 accepted outbox messages, no active test suppression and no blocked jobs. Resend's filtered metrics report 16 sent/16 simulated deliveries, zero bounced/complained/suppressed/failed. The sender connectivity canary is separate from these 16 receipts.

The marked local PostgreSQL cluster is loopback-only on port 55417. Durable provider E2E database `sitanim_payments_provider_e2e` is separate from resettable regression databases. Its SCRAM login is unprivileged, NOINHERIT and restricted to this database; the worker has six FORCE-RLS tables and no public-schema usage. Wrong-password and other-database access were rejected. The application uses only this dedicated login, never the local operator account.

Remote shared-Supabase login provisioning was deliberately deferred: read-only inspection found PUBLIC-executable SECURITY DEFINER functions `public.sync_leads_to_subscribers` and `public.refresh_operator_site_rollup`, plus managed `pg_net` PUBLIC-executable capability. The blocker is not limited to those two public functions: an ordinary login inherits shared PUBLIC privileges beyond the approved private payment schema. Federation DB lease 836 was released without a remote mutation. Do not silently revoke shared or extension-managed grants, or provision this login in the shared project. The dedicated payments database and narrow central CRM gateway require independent review and verification.

Local tools: `scripts/sitanim-payments-operator.mjs` requires Node 24 and external 0600 config; `start` binds actual Next to `127.0.0.1:3019`, `listen` captures the signing secret privately, `health`/`proof`/`evidence` are read-only, and `worker` is an explicit bounded attempt. Test owner-suppression controls are fixed to the isolated DB and the owned marker row, preserve preexisting suppressions, and never broaden worker grants. The frontend QA routes and production-404/privacy protections are documented in the frontend's `docs/support-subscription-local-qa.md`.

At this historical provider-test checkpoint, 158 backend tests, typecheck and production build (246 static pages) passed, before the later 178-test guard patch and current-baseline transplant. Frontend then had 19 policy/actual HTTP guard regressions, typecheck and production build (72 pages). Browser testing caught and fixed a no-referrer/opaque-Origin conflict and a pre-hydration selected-tier race; the launch now uses a native named select rather than mirrored hidden state. Actual-provider evidence and screenshots are in `Creative/Membership/2026-10-17-support-structure/actual-provider-*` and `subscription-test-*.png`.

Official Resend test inbox delivery outcomes are simulations, not proof that a human mailbox received mail. Neither live entitlements nor the production CRM adapter are activated.

## Dedicated Test Clock renewal evidence

One new isolated native Test Clock (`clock_1URgkBChZyGhfmDOzhBFY1Zg`) and synthetic official-test-inbox customer exercised the exact $1/month Supporter price. MCP created only these new Test objects; Dashboard advancement touched only this clock. The server restricted key was not expanded. Legacy `tok_visa`/`tok_chargeCustomerFail` source fields were used only as documented isolated Test fixtures, not added to application payment code.

Initial invoice `in_1URgkeChZyGhfmDOZn7lG1Z4` paid $1. Advancing to the next period produced a native draft invoice; a further hour allowed automatic finalization/payment. Renewal `in_1URgmUChZyGhfmDOeofw9SFd` paid $1 and generated exactly one new invoice-specific paid/complete ledger row, the same private contact, and two accepted notices. After attaching the documented post-attachment failure fixture only to this customer, advancing to the December billing attempt produced `in_1URgrLChZyGhfmDOfi2W9zv0`: open, attempted once, $0 paid/$1 due, subscription past_due. Its ledger row remains failed/pending, with two accepted failure notices; previous paid rows and their receipts remain unchanged. No later retry was advanced or claimed successful.

Final actual local aggregate after these clock cases: nine paid/complete orders, one failed/pending renewal, five private contacts, 29 native event receipts and 22 accepted outbox messages (11 customer/11 owner). Filtered Resend metrics for those exact 22 receipts report 22 sent/22 simulated deliveries, zero bounced/complained/suppressed/failed. Official-inbox simulation is not human mailbox proof. The earlier seven-order/16-message snapshot above describes the pre-clock checkpoint. Evidence: `subscription-verification-summary.json`, `test-clock-*-evidence.json` and `actual-provider-e2e-2026-10-17T23-18-56.189Z.json` in the membership Creative directory.

Frontend Test-clock-checkpoint hardening independently requires exact backend HTTP/state pairs: 200/confirmed, 202/pending, 503/failed. Contradictions cannot display success. At that checkpoint its 23 tests, typecheck and isolated 72-page production build passed; backend evidence was then 158 tests and a 246-page build, superseded by the later historical guard verification above. The confirmation page verifies an initial checkout, not ongoing subscription health. This is not the current launch candidate's build result.

## Required production/remaining gates — not passed

1. Verify the dedicated-project login, strict TLS, private grants and bound central gateway. Do not provision the schema-only login in the shared project with inherited PUBLIC/extension capabilities. Local isolated credentials and actual local provider proof do not establish remote or production readiness.
2. Deploy and verify the real receiver, worker/reconciliation schedule and authentication under fresh federation leases; a local CLI listener is not production webhook delivery.
3. Root's two approved setup canaries have provider DELIVERED proof; actual production payment customer/admin notifications and inbound human-reply proof remain separate gates. Obtain explicit approval for any additional real recipients and never reuse screenshot-only contact data. Keep required notification failures explicit and retryable.
4. Complete annual future-cycle and post-failure card-update/recovery checks, refunds/disputes and sponsor provider flows. Actual monthly renewal/failed-renewal and scheduled cancellation are covered above; do not generalize that to every lifecycle case.
5. Before enabling live mode, finish the legacy-destination ownership audit. The existing enabled destinations listen only to Checkout completion, but one targets a Vercel root URL rather than its webhook route and the other targets a missing Supabase function (read-only GET returned 404). Canonical generic newsletter/merch handlers lack catalog ownership guards and would be unsafe if wired; current destinations have not been shown to invoke those handlers or process new Sitani purchases. Do not disable unrelated endpoints based only on stale URLs/GET failures. Apply a narrow native-catalog ownership filter before any writes only after the actual destination/handler path is verified.
6. Activate no live CRM adapter until least-privilege grants and existing public-table RLS are reviewed and actual same-business new/returning contacts are tested. Preserve the free public newsletter/community.
7. Finalize seller, receipt/cancellation/refund policy, tax registrations/classification, actual partner offers, sponsor fulfillment owner and operations. Current exact-amount validation deliberately rejects tax/discount/proration differences; adapt and retest before enabling such collection. Stripe Tax was not enabled.
8. Complete the mandatory production-form release gate, acquire fresh federation leases, deploy dependencies before the frontend, and verify actual production data/message/visible confirmation paths. No live purchase activation until all applicable checks pass.
