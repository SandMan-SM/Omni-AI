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

## Do NOT Touch
- `.env` / `.env.local` — never modify env files
- `drizzle.config.ts` — database config
- `supabase/` migrations — don't run migrations autonomously
- `node_modules/`
