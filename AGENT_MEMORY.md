# 🧠 AGENT_MEMORY — OMNI-AI
> Synthetic Intelligence Memory | Updated: October 21, 2026 09:52 AM
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
3. Next: apply 'seo-metadata-factory' to any NEW route as it is created (no known backlog — all routes covered)

## 🔬 Why
- Pattern proven in cps
- Session 39 shipped the SEO/mobile pass to omnileadsagi.com; remaining work is incremental

## 📚 Stats
- Sessions: 40
- Lines written: 0

## 🔄 Edit History (last 30 — DO NOT REPEAT)
| Date | Category | What Was Done | Lines |
|---|---|---|---|
| 2026-10-21 | deploy | Shipped session 39 to production. Vercel git auto-deploy lagged ~15 min after push — the deployment DID appear in `BUILDING` then `READY` and promoted to omnileadsagi.com. Meanwhile the guarded runner (`scripts/omniclaw_deploy_guard.py deploy Website --mode prod`) deployed immediately and wrote `deploy-records/20261021T163354Z-Website-prod.json`. Federation lease 882 released (auto-journaled as changelog 1789) | 1 |
| 2026-10-21 | deploy | Root-caused the "no deployment" scare: GitHub `check-runs`/`statuses` are EMPTY for Vercel git deployments, and `[skip ci]` in an ancestor commit does NOT block later deploys. Poll for ~20 min before diagnosing a broken pipeline | 1 |
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
