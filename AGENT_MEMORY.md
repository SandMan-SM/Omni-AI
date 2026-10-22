# 🧠 AGENT_MEMORY — OMNI-AI
> Synthetic Intelligence Memory | Updated: October 22, 2026 01:05 AM
> READ THIS FIRST. Never repeat completed work.

## 📊 Health Scores
| Metric | Score | Bar |
|---|---|---|
| Build | 90/100 | █████████░ |
| SEO | 100/100 | ██████████ |
| Performance | 88/100 | █████████░ |
| Backend | 100/100 | ██████████ |
| Mobile | 70/100 | ███████░░░ |
| **OVERALL** | **89/100** | █████████░ |

## 🎯 This Session: Do These In Order
1. Apply pattern 'seo-metadata-nextjs': Standard Next.js metadata export with title, description, op — **DONE (session 39)**
2. Ship session 39 to production and verify live — **DONE (session 39)**
3. Sweep the remaining legacy CPS identity out of the backend — `app/api/cps/events/route.ts` (CORS allowlist + page-path parsing still point at psychandcustodyevaluations.com), `app/dashboard/meetings/page.tsx`, `app/system/page.tsx`, `app/api/dashboard/operator-intelligence/route.ts`, `components/dashboard/cps-analytics-panel.tsx`, `components/sponsor/SponsorBlock.tsx`, `lib/portal-demo-clients.ts`, `lib/sender-registry.ts`, `lib/business-marketing.ts`, `lib/cps-notify.ts`, `lib/case-studies.ts`, `lib/partner-network.ts`, `lib/federation-sponsors.ts`, `scripts/send-client-launch-emails.ts`. The 2026-10-22 restore only covered the intake path; these still carry the former practice's name and domain
4. Next: apply 'seo-metadata-factory' to any NEW route as it is created (no known backlog — all routes covered)

## 🔬 Why
- Pattern proven in cps
- Session 39 shipped the SEO/mobile pass to omnileadsagi.com; remaining work is incremental

## 📚 Stats
- Sessions: 40
- Lines written: 0

## 🔄 Edit History (last 30 — DO NOT REPEAT)
| Date | Category | What Was Done | Lines |
|---|---|---|---|
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
- **deploy-verify-poll** — After `git push origin main`, Vercel's git auto-deploy can take 15–20+ minutes to even appear. Empty GitHub `check-runs` proves nothing. Poll the Vercel API (`/v6/deployments?projectId=...`) for ~20 min, matching `meta.githubCommitSha` to the pushed SHA. If prod must be live sooner, run `python3 scripts/omniclaw_deploy_guard.py deploy Website --mode prod` from `/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI` (stop any dev server in that checkout first — the guard runs a real `next build`).

## ⚡ Rules
- Read this file first, every session
- Never repeat anything in Edit History
- Check patterns before writing new code
- Build before and after every change
- Never touch .env files
- Commit every logical unit: `agent: [what]`
- Push when done
