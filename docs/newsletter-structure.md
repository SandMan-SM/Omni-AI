# Interlinked Newsletter — Structure & Pipeline

## Template structure (both free and premium)

Implemented in `lib/newsletter-sender.ts` → `buildNewsletterEmailHtml(content, tier)`.

1. **Title**
   - Free: `Interlinked`
   - Premium: `Interlinked Premium` (amber accent)
2. **Subtitle line** — `by Omni AI · Daily Intelligence Brief · <date>` (premium: `Daily Premium Intelligence Brief`)
3. **Quote** — bubble with soft accent background + border, italic, centered (only if the post has a quote)
4. **Intro / hook** — plain paragraph, no bubble
5. **Today's Key Insights** — heading in cyan; each insight is a standalone paragraph (no bullets)
6. **Power Move** — soft accent card with left border
7. **CTA card** — accent-bordered card containing:
   - Tagline on top: "Schedule a free consultation anytime — and remember, you can share this with a friend."
   - `Book Now` button → `/book-now`
   - `Share` button (mailto with prefilled subject/body + link to post)
8. **Fine-print restatement** of the power move (centered, italic, muted)
9. **Read on the web** link → `/newsletter/[slug]`
10. **$50,000 certification callout** — `Join the community` link → `https://t.me/+HxMnLSV1FYs0YmIx`
11. **Today's Trends** — left-aligned keyword list (tags)
12. **Footer**
    - Free: `Manage subscription` (→ `/dashboard`) · `Upgrade to Premium` (→ `/interlinked/premium`)
    - Premium: `Manage account` (→ `/dashboard`) · `Affiliate program` (→ `/affiliate/info`)

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
    { "path": "/api/cron/newsletter?action=generate-drafts", "schedule": "0 12 * * *" },
    { "path": "/api/cron/newsletter",                        "schedule": "0 13 * * *" }
  ]
}
```

- **12:00 UTC (8:00 AM ET)** — `generateDrafts()` runs. Cleans old unpublished drafts, then generates fresh free + premium drafts and writes them to `newsletter_posts` with `published_at = null`.
- **13:00 UTC (9:00 AM ET)** — main cron runs. It:
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
- **Dev-mode allowlist** — if `NEWSLETTER_DEV_MODE !== 'false'`, only `NEWSLETTER_TO_EMAIL` (default `sitanim8@gmail.com`) actually receives emails. Everyone else is silently skipped in logs. Flip `NEWSLETTER_DEV_MODE=false` in Vercel env to go live to all subscribers.
- **Telegram** — `sendMorningDebrief` posts one clean message to the configured chat with inline buttons linking to both newsletters.

### Database

- `newsletter_posts` — drafts and published posts. `published_at`, `sent_at`, `recipients_count`, `email_sent`, `telegram_sent`.
- `newsletter_sends` — one row per send event (today's dedup guard uses this).
- `newsletter_subscribers` — standalone email signups (from the homepage / landing pages).
- `profiles.newsletter_subscribed`, `profiles.is_premium` — actual recipient filters.

## On-demand preview

`GET /api/newsletter/send-to-me?secret=$CRON_SECRET&to=sitanim8@gmail.com` — generates fresh free + premium content and emails both to the target address. Used to preview the current template without waiting for the 9 AM cron.

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
