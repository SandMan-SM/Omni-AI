# Interlinked Newsletter — Structure & Pipeline

## Three sources of truth (keep in sync)

| Layer | File |
|---|---|
| Email render | `lib/newsletter-sender.ts` → `buildNewsletterEmailHtml(content, tier)` |
| Web "read on the web" page | `app/newsletter/[slug]/page.tsx` |
| This spec | `docs/newsletter-structure.md` |

**Rule:** a change to any one of the above requires a matching change to the
other two in the **same commit**. Drift between the three is the bug this
section exists to prevent.

## Template structure (both free and premium) — email + web mirror each other

Accent pairing is tier-based: free → purple (`#a855f7`), premium → amber (`#f59e0b`).
One accent per render. Never mixed.

1. **Header eyebrow + title** — mono uppercase eyebrow in accent color
   ("Interlinked" / "Interlinked Premium"), then subtitle line
   `Daily Intelligence Brief · <date>` (or `Daily Premium Intelligence Brief · <date>`).
2. **Subject heading** — H1/H2 bold headline.
3. **Quote** — optional. Accent-soft bg + left accent border, italic,
   centered. Only if the post has a `quote` field.
4. **Intro / hook** — plain paragraph, 15–17px prose. No bubble.
5. **Today's insights** — mono uppercase label in accent color; each
   insight is a standalone paragraph (never bullets — locked rule).
   **HARD RUBRIC** (premium AND free):
   - EXACTLY 3 insights — never 4, never 5. Enforced at write-time by
     `cleanInsights()` in `lib/newsletter-sender.ts` and at the DB layer
     by the `omni_normalize_insights()` SQL helper.
   - No `**Bold header.**` lead patterns (e.g. `**The number that matters.**`).
     Stripped automatically by both helpers.
   - All prose uses curly typographic quotes (`“...”` and `’`), never
     straight ASCII quotes. Conversion runs in `smartQuotes()` and the
     `omni_smart_quotes()` SQL function.
6. **Premium · exclusive insight** — premium only, if `exclusive_insight` is set.
   Same card shape as insights.
7. **AI tool of the week** — premium only, if `ai_recommendation` is set.
   Accent-soft bg + left border callout.
8. **Power move** — accent-soft bg + left border callout. Required field.
9. **CTA block** — centered tagline + two buttons side by side:
   - Tagline (locked copy): `Book a free 30-minute strategy session — or share this with someone who needs it.`
   - **Book Now** (primary, accent bg) → `/book-now`
   - **Share** (secondary, outlined) → `mailto:` prefilled with subject = `Interlinked: <subject>` and body containing the post URL + book-now URL.
10. **$50K certification callout** — accent-soft bg + accent border.
    `Get a $50,000 certification — free` · `Sponsored by Omni AI · Join the community` (→ `https://t.me/+HxMnLSV1FYs0YmIx`).
11. **Today's trends** — mono uppercase label + keyword pills.
    **HARD RUBRIC**: EXACTLY 11 keyword tags per post — no more, no less.
    Padded by `padKeywords()` (TS) / `omni_pad_keywords()` (SQL) when the
    LLM returns fewer; trimmed when it returns more. Brand-safe fallbacks
    (`Omni AI agentic playbook`, `Interlinked Premium 2026`, etc.) are
    appended only when the post comes back short. Left-aligned on web;
    inline list on email.
12. **Footer** — mono tagline + 2 links:
    - Free: `Manage subscription` (→ `/dashboard`) · `Upgrade to Premium` (→ `/interlinked/premium`)
    - Premium: `Manage account` (→ `/dashboard`) · `Affiliate program` (→ `/affiliate/info`)

The web page additionally has: a sticky top bar (Omni AI · All issues),
single top-left accent wash background, and the footer reads as
`Omni AI · Interlinked [Premium]` + `All issues · Book a session · <tier-swap link>`.

**Dropped / deprecated fields** (exist in DB for older drafts, do NOT render):
- `offer` — no longer rendered. CTA tagline is hard-coded.
- `closing` — no longer rendered. Power move is the closer.
- `read on the web` link — email-only (there's nowhere else for the email
  to link to). Web obviously omits it.

## Content model

```ts
interface NewsletterContent {
  subject: string;
  intro: string;
  insights: string[];
  power_move: string;
  closing: string;        // deprecated in new template; not rendered
  quote?: string;
  offer?: string;         // deprecated in new template; not rendered
  keywords: string[];
  slug: string;
  tier: 'free' | 'premium';
}
interface PremiumContent extends NewsletterContent {
  day_type: 'value' | 'insight' | 'offer';
  exclusive_insight?: string;
  ai_recommendation?: string;
}
```

## Pipeline — how it gets made and sent

### Scheduling (Vercel Cron → `vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/newsletter?action=publish-public", "schedule": "5 14 * * *" }
  ]
}
```

- **14:05 UTC (8:05 AM MT during daylight time)** — `publish-public` runs. It creates today's free + premium public issues in `newsletter_posts`, stamps `published_at`, and skips Resend/Telegram/send-log side effects. This is the source of truth for `/api/newsletter/posts` and `/newsletter/rss.xml`.
- The owner-only Interlinked email can be sent by the external Hermes/Codex MCP Resend automation. That path must not be the only public publisher.
- Manual full-send mode remains available at `/api/cron/newsletter`. It:
  1. Guards against double-send (checks `newsletter_sends` for any row from today).
  2. Calls `runDailyNewsletter()` — uses today's free draft if present, else generates fresh content. Sends to every `profiles.newsletter_subscribed = true` row via Resend. Marks the draft `published_at`.
  3. Calls `runPremiumNewsletter()` — same flow, filtered to `is_premium = true`. Currently gated to Mon/Wed/Fri; remove `getDayType()` guard to send daily.
  4. Sends the morning debrief (Telegram message with links).
  5. Runs the AI CEO briefing (separate digest via `lib/ceo-briefing.ts`).
  6. Logs events to `events` table.

Both cron calls require `Authorization: Bearer ${CRON_SECRET}` — Vercel sends this automatically.

### Content generation

- OpenAI-backed (see `generateFreeContent` and `generatePremiumContent` in `lib/newsletter-sender.ts`).
- Duplicate avoidance — the caller passes an `avoid` object pulled from the last 30 days of posts (subjects, intros, power_moves, closings). The prompt is instructed to avoid reusing them.
- Premium draft generation includes the free post in its avoid list so the two don't overlap on the same day.

### Sending

- **Email** — `sendEmail(content, toAddress)` posts to Resend (`from: bookings@omnileadsagi.com`). Rendered via `buildNewsletterEmailHtml`.
- **Dev-mode allowlist** — if `NEWSLETTER_DEV_MODE !== 'false'`, only `NEWSLETTER_TO_EMAIL` (default `alfred@omnileadsagi.com`) actually receives emails. Everyone else is silently skipped in logs. Flip `NEWSLETTER_DEV_MODE=false` in Vercel env to go live to all subscribers.
- **Telegram** — `sendMorningDebrief` posts one clean message to the configured chat with inline buttons linking to both newsletters.

### Database

- `newsletter_posts` — drafts and published posts. `published_at`, `sent_at`, `recipients_count`, `email_sent`, `telegram_sent`.
- `newsletter_sends` — one row per send event (today's dedup guard uses this).
- `newsletter_subscribers` — standalone email signups (from the homepage / landing pages).
- `profiles.newsletter_subscribed`, `profiles.is_premium` — actual recipient filters.

## On-demand preview

`GET /api/newsletter/send-to-me?secret=$CRON_SECRET&to=alfred@omnileadsagi.com` — generates fresh free + premium content and emails both to the target address. Used to preview the current template without waiting for the 9 AM cron.

## Linked destinations

| Link in email | URL | Source file |
|---|---|---|
| Book Now | `/book-now` | `app/book-now/page.tsx` |
| Share | `mailto:` with subject + body + post URL | inline in template |
| Read on the web | `/newsletter/[slug]` | `app/newsletter/[slug]/page.tsx` |
| Join the community | `https://t.me/+HxMnLSV1FYs0YmIx` | external (Telegram) |
| Manage subscription / account | `/dashboard` | `app/dashboard/page.tsx` |
| Upgrade to Premium (free only) | `/interlinked/premium` | `app/interlinked/premium/page.tsx` |
| Affiliate program (premium only) | `/affiliate/info` | `app/affiliate/info/page.tsx` |
