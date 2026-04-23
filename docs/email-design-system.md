# Omni AI — Email Design System (LOCKED)

**This document is an artifact.** Once a rule here is set, it does not revert
without an explicit, reviewed change to this file. If you are editing a
template and tempted to break one of these rules — stop, re-read, and find an
email-safe alternative instead.

Every Omni AI transactional + newsletter email goes through
`lib/email-template.ts`. Do not hand-write HTML in a new email route — import
the primitives.

---

## The Five Hard Rules

Email clients (Gmail web, Gmail iOS/Android, Apple Mail, Outlook desktop,
Outlook.com, Yahoo) are stuck in roughly 2005 HTML. Violating any of these
rules means the email looks broken for at least one major client.

### 1. Layout is done with `<table role="presentation">`. Never flex, never grid.
- Gmail strips `display:flex` silently. Your neat row collapses into a vertical
  stack of full-width blocks.
- Outlook ignores `display:grid` entirely.
- KPI rows, button rows, and multi-column layouts use `<table><tr><td>` —
  always. See `kpiRow()` and `buttonRow()` in `lib/email-template.ts`.

### 2. Colors are hex literals. Never `rgba()`, never `hsl()`, never CSS vars.
- Outlook Desktop (still ~10% of B2B opens) renders `rgba()` backgrounds as
  transparent or as ugly solid black. Our previous templates used
  `rgba(16,185,129,.08)` for accent card backgrounds — in Outlook this became
  unreadable white text on white.
- Soft accent backgrounds are hard-coded in `THEME.greenBg`, `THEME.amberBg`,
  etc. — pre-computed hex that approximates the low-opacity look on our canvas.
- Canvas, surface, border, text are all flat hex. No "85% opacity over dark
  bg" — compute the resulting hex and hard-code it.

### 3. Backgrounds are solid hex. `linear-gradient` only on CTA button fills.
- Gmail strips gradients on `<div>` backgrounds. The hero card that looked
  cinematic in your browser preview is a flat white box in Apple Mail on
  iOS 15.
- CTA buttons are allowed exactly one pattern: a solid accent `<td>` with a
  padded `<a>` inside. No gradient, no box-shadow, no border-radius above 10px
  (Outlook clips larger radii).

### 4. No `<style>` block. No web fonts. No viewport units. No CSS variables.
- Gmail web strips the entire `<style>` tag before rendering. Only inline
  `style="..."` attributes survive.
- Web fonts fail in ~40% of clients. Use system stacks only:
  `THEME.fontBody` and `THEME.fontMono` in `lib/email-template.ts`.
- `vh`, `vw`, `%`-on-height all misbehave. Use `px` for heights and
  `width="640"` attribute + `max-width:640px` inline style for responsive
  outer tables.

### 5. Every email ships through `lib/email-template.ts`.
- `buildDailyBriefHtml`, `buildClientReviewHtml`, `buildNewsletterEmailHtml`
  are the only rendering entry points. Adding a new transactional email?
  Add a new `buildXyzHtml` function in the same file and compose from
  existing primitives.
- If a primitive is missing for your use case, **add it to the template
  library first**, then consume it. Do not inline one-off layout HTML in a
  caller.

---

## The Locked Palette

All values live in `THEME` in `lib/email-template.ts`. Do not hard-code these
numbers in a template file — import the constant.

| Token           | Hex       | Purpose                                    |
|-----------------|-----------|--------------------------------------------|
| `canvas`        | `#0a0a0f` | Outer body background                      |
| `surface`       | `#13131a` | Card / section background                  |
| `surfaceRaised` | `#1a1a22` | Raised card (rare — KPI highlight)         |
| `border`        | `#262631` | Default card border                        |
| `borderStrong`  | `#3a3a48` | Secondary button outline                   |
| `textPrimary`   | `#f1f5f9` | Headings, KPI values                       |
| `text`          | `#e5e7eb` | Body prose                                 |
| `textMuted`     | `#9ca3af` | Secondary meta, captions                   |
| `textSubtle`    | `#6b7280` | Labels, separator dots, muted captions     |
| `green`         | `#10b981` | CEO Daily Brief primary accent             |
| `cyan`          | `#06b6d4` | Secondary accent (MRR vs ARR, etc.)        |
| `purple`        | `#a855f7` | Interlinked Free primary accent            |
| `amber`         | `#f59e0b` | Interlinked Premium primary accent         |
| `red`           | `#ef4444` | Risk / alert accent                        |

**One accent per template.** Daily Brief = green. Free newsletter = purple.
Premium newsletter = amber. Client review = green (investor-grade). Do not
mix accents within a template — it reads as noise.

---

## The Template Map

Each production email maps to exactly one render function:

| Email                         | File / function                                        | Accent  |
|-------------------------------|--------------------------------------------------------|---------|
| CEO Daily Brief               | `lib/daily-brief.ts` → `buildDailyBriefHtml`           | green   |
| Weekly Investor Review        | `lib/client-review.ts` → `buildClientReviewHtml`       | green   |
| Interlinked Free newsletter   | `lib/newsletter-sender.ts` → `buildFreeEmailHtml`      | purple  |
| Interlinked Premium newsletter| `lib/newsletter-sender.ts` → `buildPremiumEmailHtml`   | amber   |

---

## The Structure Contract (every template)

Every email is composed in this order, top to bottom, using the primitives:

1. **`wrapper({ title, preheader, body })`** — outer shell. Preheader is the
   snippet preview shown in inbox clients; always set it to a one-line summary.
2. **`header({ eyebrow, title, meta, accent })`** — monospace eyebrow, bold
   title, optional meta line. Accent matches template.
3. **`kpiRow([...])`** — 3–5 top-line metrics. Values bold, labels tiny-mono.
4. **`callout(label, body, accent)`** — exactly one highlighted insight
   (today's focus, today's mover, today's risk). At most ONE per email.
5. **`sectionHeading(label, accent)` + `section(innerHtml)`** — repeating
   content blocks (portfolio table, ship timeline, insights, etc.). Each
   block is labeled with a mono uppercase heading above the card.
6. **`ctaBlock({ tagline, primary, secondary })`** — one clear next action.
   Never more than two buttons. Primary is always the hero action.
7. **`footer({ tagline, links })`** — `OMNI AI · <SUITE NAME>` line + optional
   links. Always present. Always centered. Always monospace tagline.

If your template skips #3, #5, or #6 — it's incomplete. If it has more than
one of #4 — cut one.

---

## What We Do NOT Do

- ❌ Dark-mode media queries that invert colors. Our design is dark by default.
- ❌ Background images. Inbox clients strip them or load them async (flash).
- ❌ Full-bleed hero images. Keep the 640px content column.
- ❌ Custom SVG icons inlined as `<img>`. Use emoji or text symbols — they
  render everywhere.
- ❌ Multiple CTA buttons above the fold. One primary, one secondary, always
  in the same `buttonRow`.
- ❌ Centered body prose. Headings and CTAs can center; paragraphs are
  left-aligned. (Centered paragraphs read as marketing fluff.)
- ❌ Bullet points for insights. Insights are paragraphs. The newsletter
  artifact (`docs/newsletter-structure.md`) already codifies this — we don't
  contradict it.

---

## Reverting Is Banned

If a future edit to any email template:
- replaces a `<table>` with a `<div>` that has `display:flex`, OR
- swaps a hex color for `rgba()`, OR
- inlines a gradient on a non-button background, OR
- adds a `<style>` block in the `<head>`, OR
- imports a Google Font

— that change must be rejected in review. The reviewer should link to this
document. The primitive that was bypassed is the correct solution; extend
`lib/email-template.ts` instead.

The failure mode we are protecting against: "it looked fine in my browser"
followed by Alfred opening Gmail on iOS the next morning and seeing the email
render as a white-bg collapsed stack with rainbow text. Every rule here exists
because that specific failure already happened at least once.

---

## Verification Before Shipping Template Changes

1. `npm run check` clean.
2. `npm run build` clean.
3. Render the template to `/tmp/sample.html` and open in a browser — quick
   sanity check that tables didn't collapse.
4. Send a sample via the appropriate endpoint (e.g.
   `curl /api/portfolio/review/omni-ai?email=1`) and open it in Gmail web
   AND Apple Mail (or Litmus if available).
5. Inbox test passes when: KPI row is horizontal, accent bg cards show color,
   button is a solid filled pill, body text is readable contrast on dark bg.
