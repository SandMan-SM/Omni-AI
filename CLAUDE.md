# CLAUDE.md — Omni AI Website

## What This Project Is
Omni AI is an AI marketing and automation agency. This is the main company website — a Next.js 14 app with Supabase backend, Stripe payments, Drizzle ORM, and Framer Motion. It markets AI-powered services for local businesses.

## Stack
- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Supabase (auth + database), Drizzle ORM
- **Payments**: Stripe
- **Deploy**: Vercel

## Commands
```bash
npm run dev          # Start dev server (uses .next/)
npm run dev:clean    # Wipe .next/ first, then start dev — use after a crash
npm run build        # Production build (writes .next/ — DO NOT run while dev is up)
npm run build:check  # Verify build locally without touching dev's .next/ (writes .next-prod/)
npm run lint
npm run check        # TypeScript check
```

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

## Agent Priorities (in order)
1. **Fix TypeScript errors** — run `npm run check` first, fix every error
2. **Fix build errors** — run `npm run build`, fix every warning and error
3. **Complete missing pages** — check `app/` for empty or stub pages and finish them
4. **SEO improvements** — add `metadata` exports to every page, ensure `<title>` and `<description>` are present
5. **Performance** — add `loading.tsx` files, add `Suspense` boundaries around data-fetching components
6. **UI polish** — follow the checklist in `/website-build-checklist.md` for every page
7. **Forms** — ensure all contact/lead forms submit data to Supabase correctly
8. **Mobile** — test all pages at 375px, fix any overflow or layout issues

## Known Issues to Fix
- Check `app/` directory for any pages that are stubs or placeholders
- Ensure Supabase queries have proper error handling
- Verify Stripe webhook handler in `app/api/` is complete
- Add `robots.txt` and `sitemap.xml` if missing

## Design Rules
- Dark theme: `bg-gray-900` / `bg-black` base
- Gold accents for CTAs
- All colors via Tailwind config tokens — no hardcoded hex
- Consistent section padding: `py-16 md:py-24`
- Max container: `max-w-7xl mx-auto px-4`

## Daily Trending Post System

This site serves daily AI/business trending topic landing pages at `omnileadsagi.com/[slug]`.

### How it works
- **`app/[slug]/page.tsx`** — Dynamic route. Fetches `title`, `description`, `topic` from the `landing_pages` Supabase table and renders a branded landing page with full SEO metadata (OG, Twitter card, JSON-LD).
- **`app/[slug]/CTAButtons.tsx`** — Client component. Two buttons on the page: primary gradient "See How Omni AI Does It →" and secondary grey "Learn More". Primary opens a modal overlay containing the lead form.
- **`app/[slug]/LeadForm.tsx`** — Client component. Name/Phone/Email form rendered inside the modal. POSTs to `/api/landing-lead`.
- **`app/api/landing-lead/route.ts`** — Inserts lead into `landing_page_leads`, sends owner notification to `alfred@omnileadsagi.com`, sends thank-you email to the lead via Resend.
- **`app/api/og/route.tsx`** — Edge route. Generates 1200×630 branded OG image for Twitter/LinkedIn rich cards via `next/og`.

### Landing page styling rules (DO NOT violate)
- **One background glow only** — single purple radial gradient (`#6366f1`) top-left, `opacity-20`, `blur-3xl`. NO second pink/magenta blob. A second glow at the bottom creates an ugly pink circle that overwhelms the design.
- **CTA section**: two buttons — primary gradient (`#6366f1 → #ec4899`) "See How Omni AI Does It →", secondary grey border "Learn More" (links to `/details`). Primary opens a modal with `<LeadForm>` inside. Do NOT render the form directly on the page. Container is `max-w-md sm:w-auto` (no max-width cap on desktop). Both buttons must have `whitespace-nowrap sm:w-auto` — never use `flex-1` on desktop or the text will wrap. Learn More border: `border-white/60` (not lower — too dim).
- **Lead form inputs**: always `bg-white/[0.08]` (transparent grey) — never white/opaque. Focus state: `bg-white/[0.12]`.
- **Stats section**: always `flex-nowrap` so all 3 stats stay on one row. Use `flex-1` per stat. Labels must be `text-white` (not gray) so they're visible against the dark background. At least `mt-36` gap between the CTA buttons and stats.
- **Topic pill**: always `text-white` — "Today's trend: [topic]" must be fully visible.
- **Stat labels**: always white (`text-white`), `uppercase`, `tracking-widest`, `text-xs sm:text-sm`.
- **OG image in tweets**: put the URL in the tweet text only — Twitter auto-renders it as a clickable rich link card. Do NOT attach via Blotato `mediaUrls` (that uploads a standalone non-clickable image). Always verify Vercel deployment is `READY` before posting so Twitter can crawl OG tags immediately.

### Daily post workflow (automated via scheduled task)
1. Find today's trending topic (viral, business/AI/culture angle)
2. Generate: `slug` (kebab-case + date), `title` (punchy headline), `description` (one-line bridge to Omni AI)
3. Insert into Supabase `landing_pages` table — page auto-live at `omnileadsagi.com/[slug]`
4. Tweet via Blotato (accountId `16153`) with the URL in the tweet text — **no manually attached image**. Twitter auto-renders the OG card from the page's meta tags.
5. Update `landing_pages` row with tweet URL and text
6. Log to `posted-content-log.json`

### Key tables (Supabase project `odvxtychuxxsudfpcqqs`)
- `landing_pages` — slug, topic, title, description, html, date, tweet_url, tweet_text
- `landing_page_leads` — slug, name, phone, email, is_newsletter_subscriber, created_at
- `landing_page_analytics` — slug, event, referrer, user_agent (tracked client-side)

### Email (Resend)
- From: `Omni AI <bookings@omnileadsagi.com>`
- Owner notifications → `alfred@omnileadsagi.com`
- User emails: warm thank-you with gradient HTML template

## Do NOT Touch
- `.env` / `.env.local` — never modify env files
- `drizzle.config.ts` — database config
- `supabase/` migrations — don't run migrations autonomously
- `node_modules/`
