# CLAUDE.md — Omni AI Website

The flagship site + agentic backend for **Omni AI**, an AI marketing/automation
agency for local businesses. Production: **https://omnileadsagi.com**. It is also
the federation control plane: client agentic dashboards, newsletters, lead-gen,
daily trending landing pages, and an admin/CEO ops layer all live in this one repo.

Owner: **Sitani Mafi** ($Mafi) — `sitanim8@gmail.com`. Acts/emails as
`alfred@omnileadsagi.com` (via Resend).

## Stack & layout
- **Next.js 14** (App Router) + **TypeScript**, dev runs on **Turbopack**.
- **Tailwind CSS** + **shadcn/ui** (Radix) + **Framer Motion**. `next-themes`, `recharts`, `react-hook-form` + `zod`.
- **Supabase** (auth + Postgres) — project `odvxtychuxxsudfpcqqs`. `@supabase/ssr` + service-role on server.
- **Drizzle ORM** (`drizzle.config.ts`) over `DATABASE_URL`/`POSTGRES_URL`.
- **Stripe** payments + webhooks. **Resend** transactional email. **@anthropic-ai/sdk** for the AGI/agent layer.
- **Deploy:** Vercel.
- Code: `app/` (routes + `app/api/*` route handlers), `lib/` (all business logic — booking, newsletter, agi, auth, cron, federation, etc.), `components/`, `scripts/` (one-off ops/migration scripts), `supabase/` (migrations).

## Commands
```bash
npm run dev          # dev server, Turbopack, 3GB heap. Reads/writes .next/
npm run dev:clean    # rm -rf .next .turbo then dev — use after a crash / stale-chunk 500s
npm run dev:slow     # dev without Turbopack (fallback when Turbopack panics)
npm run check        # tsc typecheck (guarded by clean-worktree check; ALLOW_DIRTY_WORKTREE=1 to bypass)
npm run build        # production build (writes .next/) — DO NOT run while dev is up (see Gotchas)
npm run build:check  # safe local prod build into .next-prod/ (auto-cleaned, leaves dev's .next/ alone)
npm run lint
npm run preview      # git push origin HEAD:dev --force → builds preview at omni-ai-git-dev-…vercel.app
npm run preview:open # open that preview URL
```

## Deploy & env
- **Deploy = git push.** `origin` is `github.com/SandMan-SM/omni-ai`. Vercel auto-deploys:
  - **`main` → production** (omnileadsagi.com). Push to main to ship live.
  - **`dev` → preview** (use `npm run preview`, which force-pushes HEAD:dev).
- Preferred build path is **Vercel, not local** — Vercel has clean infra. When a local Tailwind/Turbopack cache wedges (ENOENT on a file that exists), deploy and verify in prod rather than fighting it.
- Env files are **never edited** by the agent. To inspect prod vars: `vercel env pull .env.local --environment=production`.
- Env var NAMES (never values): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`/`POSTGRES_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `CRON_SECRET`, `ADMIN_API_KEY`, plus federation/cron/telegram/twilio/namecheap secrets. **Never print or commit secret values.**

## Dev server hygiene (READ THIS BEFORE TROUBLESHOOTING)
**Why the dev server keeps crashing**: `npm run build` writes to `.next/` while
`npm run dev` is also reading from `.next/`. Race condition → stale chunks →
`Cannot find module './XXXX.js'` → 500s on every page.

**The rule**: never run `npm run build` while `npm run dev` is running in the
same checkout. Either:
- Push to git and let Vercel build (preferred — Vercel has its own clean infra)
- Use `npm run build:check` locally (writes to `.next-prod/`, auto-cleaned, leaves
  dev server's `.next/` alone)

**If the dev server is misbehaving**: `npm run dev:clean` (one command — kills
stale cache and reboots). If port is held by a zombie process:
`lsof -iTCP:3001 -sTCP:LISTEN -t | xargs -r kill -9` then `dev:clean`.

**Only one dev server per checkout**: Don't spawn a second one via `npm run dev`
on a different port — they fight over `.next/` the same way build does. Use the
single registered preview server instead.

## Auth model (route handlers)
- Three surfaces: **cookie session**, custom `omni_token` bearer (base64 JSON), and ops secrets `CRON_SECRET` / `ADMIN_API_KEY`.
- `lib/api-auth.ts` → **`authorizeCronOrAdmin()`** gates write routes; accepts `CRON_SECRET` via Bearer or an admin session. Use it on EVERY new write/PATCH route under `app/api/`.
- Cron-fired routes that call other internal routes must **forward `CRON_SECRET`** as `Authorization: Bearer ${CRON_SECRET}` or the downstream gate 404s/401s silently.
- Secret comparisons use constant-time (`constantTimeEqual`). Don't weaken to `===`.

## Agent Priorities (in order)
1. **Fix TypeScript errors** — run `npm run check` first, fix every error.
2. **Fix build errors** — run `npm run build`, fix every warning and error.
3. **Complete missing pages** — check `app/` for empty or stub pages and finish them.
4. **SEO improvements** — add `metadata` exports to every page; ensure `<title>` and `<description>` are present.
5. **Performance** — add `loading.tsx` files, add `Suspense` boundaries around data-fetching components.
6. **UI polish** — follow the checklist in `/website-build-checklist.md` for every page.
7. **Forms** — ensure all contact/lead forms submit data to Supabase correctly.
8. **Mobile** — test all pages at 375px, fix any overflow or layout issues.

## Known Issues to Fix
- Check `app/` directory for any pages that are stubs or placeholders.
- Ensure Supabase queries have proper error handling.
- Verify Stripe webhook handler in `app/api/` is complete.
- Add `robots.txt` and `sitemap.xml` if missing.

## Conventions
- **Design:** dark theme — base `bg-gray-900`/`bg-black`, **gold accents for CTAs**. All colors via Tailwind config tokens — **no hardcoded hex** in components. Consistent section padding `py-16 md:py-24`; max container `max-w-7xl mx-auto px-4`.
- **SEO:** every page exports `metadata` (title + description); OG/Twitter/JSON-LD where it matters. `robots.ts`, `sitemap`, `llms.txt`, `opengraph-image.tsx` exist — keep them current.
- **JSX text:** escape raw quotes/apostrophes (`&apos;` `&ldquo;` `&rdquo;`) — raw `'`/`"` in JSX trips ESLint `react/no-unescaped-entities` and **fails the Vercel build**.
- **Time:** anchor "today"/daily logic to **Pacific Time**. Vercel runs UTC, so naive `new Date()` makes briefings/digests/crons off by a day.
- Forms POST to `app/api/*` handlers that insert into Supabase + notify via Resend.

## Daily trending landing pages (`omnileadsagi.com/[slug]`)
This site serves daily AI/business trending-topic landing pages at `omnileadsagi.com/[slug]`.

### Files / how it works
- **`app/[slug]/page.tsx`** — Dynamic route. Fetches `title`, `description`, `topic` from the `landing_pages` Supabase table and renders a branded landing page with full SEO metadata (OG, Twitter card, JSON-LD).
- **`app/[slug]/CTAButtons.tsx`** — Client component. Two buttons: primary gradient "See How Omni AI Does It →" and secondary grey "Learn More". Primary opens a modal overlay containing the lead form.
- **`app/[slug]/LeadForm.tsx`** — Client component. Name/Phone/Email form rendered inside the modal. POSTs to `/api/landing-lead`.
- **`app/api/landing-lead/route.ts`** — Inserts lead into `landing_page_leads`, sends owner notification to `alfred@omnileadsagi.com`, sends thank-you email to the lead via Resend.
- **`app/api/og/route.tsx`** — Edge route. Generates **1200×630** branded OG image for Twitter/LinkedIn rich cards via `next/og`.

### Landing page styling rules (DO NOT violate)
- **One background glow only** — single purple radial gradient (`#6366f1`) top-left, `opacity-20`, `blur-3xl`. NO second pink/magenta blob. A second glow at the bottom creates an ugly pink circle that overwhelms the design.
- **CTA section**: two buttons — primary gradient (`#6366f1 → #ec4899`) "See How Omni AI Does It →", secondary grey border "Learn More" (links to `/details`). Primary opens a modal with `<LeadForm>` inside. Do NOT render the form directly on the page. Container is `max-w-md sm:w-auto` (no max-width cap on desktop). Both buttons must have `whitespace-nowrap sm:w-auto` — never use `flex-1` on desktop or the text will wrap. Learn More border: `border-white/60` (not lower — too dim).
- **Lead form inputs**: always `bg-white/[0.08]` (transparent grey) — never white/opaque. Focus state: `bg-white/[0.12]`.
- **Stats section**: always `flex-nowrap` so all 3 stats stay on one row. Use `flex-1` per stat. Labels must be `text-white` (not gray) so they're visible against the dark background. At least `mt-36` gap between the CTA buttons and stats.
- **Topic pill**: always `text-white` — "Today's trend: [topic]" must be fully visible.
- **Stat labels**: always white (`text-white`), `uppercase`, `tracking-widest`, `text-xs sm:text-sm`.
- **OG image in tweets**: put the URL in the tweet text only — Twitter auto-renders it as a clickable rich link card. Do NOT attach via Blotato `mediaUrls` (that uploads a standalone non-clickable image). Always verify the Vercel deployment is `READY` before posting so Twitter can crawl OG tags immediately.

### Daily post workflow (automated via scheduled task)
1. Find today's trending topic (viral, business/AI/culture angle).
2. Generate: `slug` (kebab-case + date), `title` (punchy headline), `description` (one-line bridge to Omni AI).
3. Insert into Supabase `landing_pages` table — page auto-live at `omnileadsagi.com/[slug]`.
4. Tweet via Blotato (accountId `16153`) with the URL in the tweet text — **no manually attached image**. Twitter auto-renders the OG card from the page's meta tags.
5. Update the `landing_pages` row with tweet URL and text.
6. Log to `posted-content-log.json`.

### Key tables (Supabase project `odvxtychuxxsudfpcqqs`)
- `landing_pages` — slug, topic, title, description, html, date, tweet_url, tweet_text.
- `landing_page_leads` — slug, name, phone, email, is_newsletter_subscriber, created_at.
- `landing_page_analytics` — slug, event, referrer, user_agent (tracked client-side).

### Email (Resend)
- From: `Omni AI <bookings@omnileadsagi.com>`.
- Owner notifications → `alfred@omnileadsagi.com`.
- User emails: warm thank-you with gradient HTML template.

## Federation newsletters (separate masthead repos + this site)
- Premium/paid issues are **Omni-AI-only** — no other-business shoutouts.
- Free issues get **exactly ONE business shoutout per week**, alternating businesses every Wednesday (recent order: Prime IV, then Love Thy Barber). Never stack multiple shoutouts in a week — the owner is emphatic about not cluttering content (one shoutout/week for maximum conversion).
- Shoutout = iMessage-style preview card (`components/newsletter/FeaturedBusinessCard.tsx`) with site preview + share button + a sharable description like a forwarded text. Deals baked in: **Prime IV** = new-client deal in image (~$85 intro); **Love Thy Barber** = "$5 off your first visit" (as the end of the sharable description).
- Always feature sponsor links without crowding the primary one: **Fred's** `https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc` (main sponsor) and **livebetterpodcast.com** (Jaime Bond / Prime IV, "in partnership with omnileadsagi.com"). Lead-gen should route back to sponsors.
- Newsroom voice: dry, clear-eyed, skeptical of marketing, generous to operators who deliver. **No invented quotes** — write around quotes you don't have. Every claim sourceable; don't fabricate Utah-business facts. 700–1100 words. Rotate the cast; increment "Vol. I · No. N".
- **Idempotent publishing:** before posting, `ls <repo>/posts/ | grep <today>` — if today's file exists, skip, never overwrite.

### Masthead publishing schedule (scheduled task `omni-newsroom-daily-publish`)
Run `date "+%Y-%m-%d (%A)"` first; use UTC date where the local-vs-UTC distinction matters for a masthead's slug naming. Drafts go into each repo's `posts/` folder, then commit + push via git; the dispatch cron at **14:00 UTC** mails them out. Each repo has an `origin` remote on GitHub that auto-deploys to Vercel.
- **Beehive Biz Pulse** — daily M–F (Mon/Tue/Wed/Thu/Fri); skip Sat + Sun. Repo: `/Users/janahasson/Desktop/Clients/Beehive-Biz-Pulse`.
- **The Wasatch Post** — Tuesday + Friday only. Repo: `/Users/janahasson/Desktop/Clients/Wasatch-Post`.
- **Utah Main Street** — Mondays only. Repo: `/Users/janahasson/Desktop/Clients/Utah-Main-Street`.
- If today is Saturday or Sunday, exit immediately with "No publishing today — weekend."

## Agentic dashboards (`/dashboard`, `/admin`)
- Each client business has an agentic dashboard fed by per-website analytics. Owner's #1 standing demand: **analytics synced to every dashboard with 100% accuracy** — leads, profiles, newsletter status all live and correct.
- The "All businesses" view must default to **All** (not silently fall back to "Omni AI"); admin switches scope via the agentic-assets tab.
- Pitfalls seen: (1) scope pills must dispatch a synthetic `StorageEvent` to propagate; (2) a Supabase query builder reused across awaited calls **caches results** — build a fresh query per call or you leak one tenant's data (e.g. 320 leads showing instead of 2). Cross-tenant leaks are a real risk — gate GET/PATCH with `authorizeCronOrAdmin`.

## Gotchas
- **Never `npm run build` while `npm run dev` is running** in the same checkout — both touch `.next/`, causing stale chunks → `Cannot find module './XXXX.js'` → 500s. Use `npm run build:check` (writes `.next-prod/`) or just push and let Vercel build.
- **One dev server per checkout.** Don't spawn a second on another port — they fight over `.next/` too. If a port's held: `lsof -iTCP:3001 -sTCP:LISTEN -t | xargs -r kill -9` then `npm run dev:clean`.
- **Turbopack BorrowMutError panic** under rapid file edits is cosmetic to prod — TypeScript still passes and Vercel builds fine. Recover with `dev:clean` or fall back to `npm run dev:slow`.
- `npm run check` / `build:check` are wrapped by `scripts/ensure-clean-worktree.mjs`; set `ALLOW_DIRTY_WORKTREE=1` if you intentionally have uncommitted work.

## Do / Don't
- **Do** keep working continuously — the owner runs a "continuous execution" doctrine and explicitly does not want "should I continue?" pauses. Ship, verify against the live DB, move to the next fix. Stop only on a new instruction, completion+verification, a safety boundary, or unrecoverable failure.
- **Do** verify fixes against the live Supabase data, not just types — "TypeScript passes" is necessary, not sufficient.
- **Do** email the owner action items he must do personally to `sitanim8@gmail.com`, sent from `alfred@omnileadsagi.com` via Resend.
- **Don't** add a second background glow, render the lead form inline, or use `flex-1` on desktop CTA buttons.
- **Don't** post more than one business shoutout per week, or put other businesses in premium newsletters.
- **Don't** modify `.env` / `.env.local` (never modify env files), run Supabase migrations autonomously, or touch `drizzle.config.ts` / `node_modules/`.
- **Don't** leave a write/PATCH API route un-gated by `authorizeCronOrAdmin`.

## Do NOT Touch
- `.env` / `.env.local` — never modify env files.
- `drizzle.config.ts` — database config.
- `supabase/` migrations — don't run migrations autonomously.
- `node_modules/`.

## Glossary
- **Federation** — the portfolio of client businesses Omni AI runs (sites, dashboards, newsletters) from this repo.
- **Mastheads** — the individual newsroom/newsletter publications, each its own git repo with a `posts/` dir that auto-deploys to Vercel; a 14:00 UTC dispatch cron mails new posts.
- **AGI layer** (`lib/agi/*`, `app/api/agi/*`) — the Anthropic-powered agent automation: lead scraping/scoring, replies, digests, autopilot.
- **Agentic dashboard** — a client's per-business analytics/ops view at `/dashboard`.
- **Fred** — main sponsor (circlern.com host link). **Jaime Bond** — Prime IV owner / Live Better podcast. **Sammy** — an LTB dashboard user (tenant-scoping test case).
- Portfolio businesses include: Prime IV (Sandy), Love Thy Barber (LTB), Phoenix Exteriors, Leifson, CPS.
