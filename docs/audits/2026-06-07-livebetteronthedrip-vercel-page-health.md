# LiveBetter On The Drip Vercel/Page Health Audit

Date: 2026-06-07
Canonical domain: https://livebetteronthedrip.com
Old domain: https://livebetterpodcast.com
Vercel project: on-the-drip-deploy (`prj_fMbA7PSCnklJt5xbBy37xN7MNdQo`)
Production deployment inspected: `dpl_ARJpVJ5ki4cSYKvK4yPNcjfB7Tkc`

## What was verified

- Vercel project lookup found `on-the-drip-deploy`.
- Latest production deployment is `READY` and `PROMOTED`.
- Latest deploy aliases include:
  - `livebetteronthedrip.com`
  - `www.livebetteronthedrip.com`
  - `livebetterpodcast.com`
  - `www.livebetterpodcast.com`
- Old domain redirects to canonical root:
  - `https://livebetterpodcast.com/` → `https://livebetteronthedrip.com/`
  - `https://www.livebetterpodcast.com/` → `https://livebetteronthedrip.com/`
- Build logs show deployment completed. Build warning: Vercel compiles ESM functions to CommonJS; not fatal.
- Sitemap crawl: 243 URLs, all returned HTTP 200.
- Sitemap pages had titles and H1s; no old `livebetterpodcast.com` references found in returned HTML.
- Homepage internal links crawled: 49, all returned HTTP 200.
- Booking modal opens and is visually usable; fields render for full name, phone, email, and CTA.

## Issues found

1. **Missing-route fallback hides broken pages**
   - Non-sitemap routes such as `/episodes`, `/guest`, `/sponsor`, `/contact`, `/pricing`, `/rss.xml`, `/feed.xml`, and `/api/health` return the homepage shell with HTTP 200 instead of distinct route content, feed XML, JSON, or 404.
   - This makes pages look “not broken” to a shallow HTTP check while users see the wrong page.
   - Highest-risk examples:
     - `/api/health` → returns homepage HTML, not JSON.
     - `/rss.xml` and `/feed.xml` → return homepage HTML, not XML feeds.
     - `/pricing` → returns homepage HTML, not pricing or 404.

2. **Canonical domain changed but control-plane references were stale**
   - Patched in Omni AI repo references from `livebetterpodcast.com` to `livebetteronthedrip.com` across 16 files.
   - Updated `CLAUDE.md`, sponsor embeds, federation sponsor config, inbound origins, case studies, dashboard business fallback, and client agent registry.

3. **Visual/content polish issue on homepage service cards**
   - Service and podcast image cards render as gray placeholder blocks in the visual smoke screenshot while image URLs return HTTP 200. Likely CSS/lazy-loading/object-fit/overlay issue, not missing image files.

4. **Domain ownership API visibility limitation**
   - `vercel_get_domain` returned 403 for both canonical and old domains, but project/deployment aliases confirm both are attached to the production deployment.

## Recommended fix order

1. Add explicit static or server routes for expected public surfaces:
   - `/episodes`
   - `/guest`
   - `/sponsor`
   - `/contact`
   - `/pricing` or intentionally redirect/remove references
   - `/rss.xml` or `/feed.xml` if feed links are expected
   - `/api/health` returning JSON
2. Tighten `vercel.json` rewrites/fallback so unknown routes do not silently serve the homepage as 200 unless intentionally part of a SPA router.
3. Fix service-card and podcast image display so loaded images are visible, not gray placeholders.
4. Re-run sitemap + common-route content assertions; do not accept HTTP 200 alone.

## Verification commands used

- Vercel project/deployment inspection via Vercel MCP.
- Python sitemap crawl against `https://livebetteronthedrip.com/sitemap.xml`.
- Homepage internal link crawl.
- Browser smoke check + modal screenshot.
- Omni AI repo TypeScript check after domain reference patch: `ALLOW_DIRTY_WORKTREE=1 npm run check:dirty` → passed.

## Procedure update made

Patched `website-dev` skill project path note so LBOTD uses `livebetteronthedrip.com` as canonical and keeps `livebetterpodcast.com` as the old domain.
