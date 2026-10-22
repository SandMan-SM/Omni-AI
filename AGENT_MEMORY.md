# 🧠 AGENT_MEMORY — OMNI-AI
> Synthetic Intelligence Memory | Updated: October 22, 2026 02:40 AM
> READ THIS FIRST. Never repeat completed work.

## 📊 Health Scores
| Metric | Score | Bar |
|---|---|---|
| Build | 90/100 | █████████░ |
| SEO | 100/100 | ██████████ |
| Performance | 90/100 | █████████░ |
| Backend | 100/100 | ██████████ |
| Mobile | 72/100 | ███████░░░ |
| **OVERALL** | **90/100** | █████████░ |

## 🎯 This Session: Do These In Order
1. ~~Sweep the remaining legacy CPS identity out of the backend~~ — **DONE (session 41)**
2. Ship session 41 to production and verify live — **DONE (session 41)**
3. Chase the owner decisions this repo is now blocked on (see "Owner Decisions Pending" below) — **OPEN** (owner emailed 2026-10-22 with the consolidated list; awaiting reply)
4. Next: apply 'seo-metadata-factory' to any NEW route as it is created (no known backlog — all routes covered)
5. Next: rename the four empty `psychcustody_*` tables to `cps_*` — **needs an owner-authorized migration session** (the agent may not run migrations)

## 🔬 Why
- The CPS identity sweep was the last mechanical sweep in the repo; what remains needs the owner's call, not another agent pass
- Three live send defects surfaced during the sweep that the owner has to resolve — they need a Resend/brand decision, not code

## 📌 Owner Decisions Pending (do not act unilaterally)
- **`cpsutah.org` is not verified in Resend.** The account's 10 verified domains are `leadfranchise.org`, `sitanimafi.com`, `omnios.news`, `theixnetwork.com`, `utahmainstreet.com`, `secretimperium.com`, `lovethybarber.shop`, `alira.live`, `highteawithellieg.com`, `omniltd.app`. Until CPS's domain is verified, CPS mail sends from the house sender (`omnios.news`). Verify it and then re-point `BRAND_SENDING_DOMAIN` in `lib/sender-registry.ts`.
- **Two `marketing_campaigns` rows are `active` with senders that cannot send** — `rene@renelaveau.com` and `alfred@omnileadsagi.com`. Neither domain is in the Resend account, so both 403 at send time. They need a sender re-point, not a code fix.
- **Homepage still titles as "Interlinked"** while every other page says Omni AI. Asked the owner in session 39; still unanswered.
- **`/cps/marketing` is publicly reachable** and exposes the client's lead counts, spend, and asset valuation to anyone with the URL. It reads as an intentionally shareable explainer, so gating it is the owner's call, not the agent's.
- **Four empty `psychcustody_*` tables** (`psychcustody_contacts`, `psychcustody_campaigns`, `psychcustody_campaign_sends`, `psychcustody_contact_events`) still carry the legacy name. They are 0 rows and unreferenced by code, so the rename is cosmetic — but it needs a migration, and the agent may not run migrations.

## 📚 Stats
- Sessions: 42
- Lines written: 143

## 🔄 Edit History (last 30 — DO NOT REPEAT)
| Date | Category | What Was Done | Lines |
|---|---|---|---|
| 2026-10-22 | copy | Emailed the owner (`sitanim8@gmail.com`) the consolidated decision list left open by the CPS sweep: verify `cpsutah.org` in Resend; re-point the two `active` `marketing_campaigns` senders that cannot send (`rene@renelaveau.com`, `alfred@omnileadsagi.com`); the homepage still titles as "Interlinked"; whether `/cps/marketing` should be gated; and the four empty `psychcustody_*` tables that need an authorized migration. Sent from `Omni AI <bookings@omnios.news>` — `omnileadsagi.com` is not verified in the Resend account, so it cannot be the sender |
| 2026-10-22 | data | **Live-data half of the CPS identity sweep.** Three content sources are DB rows, not code, and all three still carried the legacy practice's identity: `omni_businesses.partnership_blurb` (slug `cps`, surfaced on `/partners/cps`), `marketing_campaigns.body_md_template` (id `5a12cf01-68e2-4813-a589-2ff8b193e85f`, the copy every CPS campaign email is built from), and `federation_owners.notes` (id `9e1d131d-2c4b-481a-bf9d-5ef96b0de148`). All three patched to the live brand; `omni_businesses.name`/`website`/`industry` already matched the code, confirming the DB was the authority. The four `psychcustody_*` tables (`psychcustody_contacts`, `psychcustody_campaigns`, `psychcustody_campaign_sends`, `psychcustody_contact_events`) are **empty (0 rows) and unreferenced by any code** — renaming them is pure rename with no data risk but still needs a migration, which the agent may not run |
| 2026-10-22 | gotcha | **`/partners/[slug]` is ISR'd at `export const revalidate = 600`** — patching the DB row does NOT change the live page. Expect the old copy for up to 10 minutes and poll until it flips; do not re-patch the row a second time. Confirmed `legacy_refs=0` at 01:50:18 Pacific. Pages that read live DB content without a `revalidate` export (`/federation/case-studies/[slug]` is `force-dynamic`) refresh on the next request |
| 2026-10-22 | perf | `/federation/case-studies/[slug]` is `force-dynamic` and awaits seven Supabase query rounds before rendering, and `/vs/[competitor]` had no skeleton either — both now use the shared `PageLoading` treatment | 10 |
| 2026-10-22 | bugfix | **CPS identity sweep.** The 2026-10-22 restore only rebranded the CPS *intake* path; fourteen backend files and four public pages still carried the former practice's name and domain. Identity now matches the live `omni_businesses` row (`name` "Clinical and Professional Solutions", `website` cpsutah.org, `industry` "Utah community and professional solutions"). Two live send defects found while sweeping: (a) `lib/business-marketing.ts` `VERIFIED_DOMAINS` was a 2026-05-10 snapshot still naming `omnileadsagi.com` (unverified since 2026-08-06) and `psychandcustodyevaluations.com` (gone) — listing a domain that cannot send turns a queued campaign into a 403 at send instead of a clean rejection at enqueue, so it was reconciled against the live account; (b) `lib/sender-registry.ts` mapped the *retired* CPS domain to a sending domain and had no entry for the live `cpsutah.org`, so CPS mail fell through to an unsendable default — now maps to the house sender. Also: the meetings dashboard linked CPS at `/book-consultation`, which 404s on cpsutah.org (now `/booknow`); the `/api/cps/events` CORS allowlist still pointed at the old domain and would 403 the current site's beacons; and the ops newsletter fleet's CPS override matched `"/CPS/cps-website"`, a directory that no longer exists, so the override was silently inert — now matches `"/CPS/"` | 141 |
| 2026-10-22 | pattern | **Never port a Next 15 commit onto a Next 14 `main` by file copy.** `a4a3d3e1` was authored on Next 15.5.27 and carried `params: Promise<...>` route-handler signatures plus a `next` major upgrade in `package.json`; `main` is Next 14.2.35. Restore route *files* and hand-port only the behaviour, never the framework-version diff. Verify with `node -p "require('next/package.json').version"` in the target repo, and let the restored repo's own tests catch the rest — `lib/server/cps-appointment-intake.test.ts` failed loudly on the first restore because `lib/inbound-types.ts` had been missed |
| 2026-10-22 | bugfix | **CPS intake outage fixed.** The 2026-10-21 sitewide SEO deploy shipped `main`, which never contained the CPS receiver files — they lived only on `a4a3d3e1` and its descendants — so the live build was missing exactly `api/inbound/cps/appointments`, `api/inbound/cps/newsletter` and `api/inbound/cps/newsletter/unsubscribe`, and every CPS lead and newsletter submission on cpsutah.org failed closed with a 503. Restored all three routes plus `lib/server/cps-*` (intake, policy, token, postgres config) from `a4a3d3e1`, rebranded the `cps` origin allowlist in `lib/inbound-types.ts` and the `cps` newsletter brief, disabled the CPS automated publication fan-out, and retired the legacy CPS writers with 410. Deployed as `09221fac` (deployment `dpl_GuAJynxtuAFxYvmpDm9iUwPA5mif`), federation lease 896 released, record `deploy-records/20261022T065121Z-Website-prod.json` | 4235 |
| 2026-10-21 | deploy | Shipped session 39 to production. Vercel git auto-deploy lagged ~15 min after push — the deployment DID appear in `BUILDING` then `READY` and promoted to omnileadsagi.com. Meanwhile the guarded runner (`scripts/omniclaw_deploy_guard.py deploy Website --mode prod`) deployed immediately and wrote `deploy-records/20261021T163354Z-Website-prod.json`. Federation lease 882 released (auto-journaled as changelog 1789) | 1 |
| 2026-10-21 | deploy | Root-caused the "no deployment" scare: GitHub `check-runs`/`statuses` are EMPTY for Vercel git deployments, and `[skip ci]` in an ancestor commit does NOT block later deploys. Poll for ~20 min before diagnosing a broken pipeline | 1 |
| 2026-10-21 | copy | Emailed the owner (`sitanim8@gmail.com`) the one decision this pass left open: the homepage still titles as "Interlinked — Free Premium AI Intelligence" while every other page now identifies as Omni AI. Asked him to pick "keep Interlinked" vs "move the homepage to Omni AI" — do not rename it unilaterally | 1 |
| 2026-10-21 | bugfix | The Resend account behind `RESEND_API_KEY` has `omnileadsagi.com` UNVERIFIED (sending from it 403s). The site's real verified senders are `omnios.news`, `sitanimafi.com`, `leadfranchise.org`, `secretimperium.com`, `lovethybarber.shop`, `alira.live`, `theixnetwork.com`, `omniltd.app`, `utahmainstreet.com`, `highteawithellieg.com`. `CLAUDE.md`'s "From: Omni AI <bookings@omnileadsagi.com>" is stale — use `Omni AI <bookings@omnios.news>` | 1 |
| 2026-10-21 | seo | Added `lib/seo.ts` (`buildMetadata` factory: title/description/keywords/canonical/openGraph/twitter/robots) + one metadata layout per route that had none — 29 new layouts covering every dashboard tab, admin surface, login, assets, and club-obsidian share routes | ~900 |
| 2026-10-21 | seo | `robots.ts` now disallows `/assets`, `/login`, `/club-obsidian/` alongside the existing internal paths | 1 |
| 2026-10-21 | perf | Added `components/page-loading.tsx` shared skeleton + `loading.tsx` on the 11 dynamic routes that shipped without one (referral pages, booking, partners, search, council/federation, lp + p slugs) | 12 |
| 2026-10-21 | bugfix | Tier landing pages (`public/tiers/*.html`): hide the Google Calendar link instead of leaving a dead `href="#"` when the booking API returns no calendar URL | 5 |
| 2026-10-21 | bugfix | `.eslintrc.json` override disables `@next/next/no-img-element` for opengraph/twitter image files (satori requires a raw `<img>`) — build is now warning-free | 1 |
| 2026-10-21 | mobile | `/subscribe` used `fixed inset-0 overflow-hidden` on `<main>`, clipping the subscribe form out of reach on short viewports. Now `min-h-screen` so the page scrolls | 1 |
| 2026-10-21 | mobile | Daily landing-page lead modal (`app/[slug]/CTAButtons.tsx`) had no height cap — submit button unreachable in landscape / with collapsed browser chrome. Added `max-h-[90dvh] overflow-y-auto overscroll-contain` | 1 |
| 2026-10-21 | bugfix | Case-study CTA pointed at `/book/omni` (a business id matching no `omni_businesses` row). Now points at the canonical `/book-now` conversion surface | 1 |
| 2026-10-21 | copy | Removed an emoji from the `/book/[business]` confirmation copy (site copy carries no emoji) | 1 |
| 2026-10-21 | seo | 77 pages overrode the whole `twitter` block and dropped the root layout's verified `@SitaniMafi` site/creator attribution — added it back to every block that lacked it | 77 |

## 🌐 Patterns To Apply
- **seo-metadata-nextjs** — Standard Next.js metadata export with title, description, openGraph, a
- **seo-metadata-factory** — Route metadata goes through `buildMetadata()` in `lib/seo.ts` instead of a hand-rolled object. Client pages can't export `metadata`, so they get a sibling `layout.tsx` that exports it and renders `children`.
- **twitter-handle-parity** — Any page that overrides the `twitter` block must re-declare `site`/`creator: "@SitaniMafi"`. Next.js metadata is shallow-merged, so a partial override silently drops the root's fields.
- **brand-truth-from-db** — When a tenant's brand is in question, the live `omni_businesses` row is the authority, not the code. `select name, website, industry from omni_businesses where slug = '<tenant>'` gave "Clinical and Professional Solutions" / cpsutah.org / "Utah community and professional solutions" while fourteen files still said "Psych & Custody Evaluations". Read the row first, then sweep the code to match it — and cross-check `case-studies.ts` (federation vocabulary) against `omni_businesses.slug` (DB vocabulary), which are deliberately different.
- **resend-allowlist-is-live-data** — Any list of "domains we can send from" is a cache of the Resend account and rots silently. Reconciled 2026-10-22: the account holds exactly ten verified domains, and the old lists still named three domains that are not in it. Re-derive with `GET https://api.resend.com/domains` before trusting either `VERIFIED_SENDING_DOMAINS` (lib/sender-registry.ts) or `VERIFIED_DOMAINS` (lib/business-marketing.ts) — the second gates campaign *enqueue*, so a stale entry converts a clean rejection into a 403 at send time.
- **deploy-verify-poll** — After `git push origin main`, Vercel's git auto-deploy can take 15–20+ minutes to even appear. Empty GitHub `check-runs` proves nothing. Poll the Vercel API (`/v6/deployments?projectId=...`) for ~20 min, matching `meta.githubCommitSha` to the pushed SHA. If prod must be live sooner, run `python3 scripts/omniclaw_deploy_guard.py deploy Website --mode prod` from `/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI` (stop any dev server in that checkout first — the guard runs a real `next build`).
- **federation-over-postgrest** — `federation.surfaces` / `work_leases` / `changelog` are NOT exposed as PostgREST tables and direct Postgres is DNS-blocked from the agent's machine. Reach them through the RPCs instead: `POST /rest/v1/rpc/hermes_federation_surface` with `p_domain`, `hermes_federation_acquire_lease` with `p_target/p_agent/p_kind/p_session_ref/p_note/p_ttl_minutes`, and `hermes_federation_release_lease`. Listing the RPC names: `GET /rest/v1/` with `Accept: application/openapi+json`.

## ⚡ Rules
- Read this file first, every session
- Never repeat anything in Edit History
- Check patterns before writing new code
- Build before and after every change
- Never touch .env files
- Commit every logical unit: `agent: [what]`
- Push when done
