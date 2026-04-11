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
npm run dev       # Start dev server
npm run build     # Build for production
npm run lint      # Run linter
npm run check     # TypeScript check
```

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
- **`app/[slug]/LeadForm.tsx`** — Client component. Name/Phone/Email form. POSTs to `/api/landing-lead`.
- **`app/api/landing-lead/route.ts`** — Inserts lead into `landing_page_leads`, sends owner notification to `sitanim8@gmail.com`, sends thank-you email to the lead via Resend.
- **`app/api/og/route.tsx`** — Edge route. Generates 1200×630 branded OG image for Twitter/LinkedIn rich cards via `next/og`.

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
- Owner notifications → `sitanim8@gmail.com`
- User emails: warm thank-you with gradient HTML template

## Do NOT Touch
- `.env` / `.env.local` — never modify env files
- `drizzle.config.ts` — database config
- `supabase/` migrations — don't run migrations autonomously
- `node_modules/`
