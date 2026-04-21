# Omni AI — Web Design System (LOCKED)

**This document is an artifact.** Once a rule here is set, it does not revert
without an explicit, reviewed change to this file. Companion to
`docs/email-design-system.md` — where that doc locks the email side (2005-era
HTML constraints), this one locks the web side: the pages that emails LINK TO.

The golden rule: **the web page a link opens must feel a full tier more
premium than the email it came from.** If the email showed a KPI row, the web
page shows the same KPIs bigger, with smooth animation, live polling, and the
full data table underneath. Never less. Never broken. Never reverted.

---

## The Five Web Rules

### 1. Every linked-from-email page uses the locked primitives in `components/ui/web-primitives.tsx`.
- `PageShell`, `PageHero`, `KpiGrid`, `Thermometer`, `Card`, `SectionLabel`,
  `PageFooter`, `PillBadge`, `SparkArea`.
- If a primitive is missing for your use case, **add it to
  `components/ui/web-primitives.tsx` first**, then consume. Never inline
  one-off hero HTML in a page file.

### 2. The locked token palette (CSS-variable-free, Tailwind-expressible).
Every web page linked from an email uses these exact tokens. Do not hand-pick
new hex colors — map to existing ones.

| Token              | Hex         | Role                                  |
|--------------------|-------------|---------------------------------------|
| `bg-canvas`        | `#05050a`   | Outer page background                 |
| `bg-surface`       | `#0d0d14`   | Card / section                        |
| `bg-surface-raised`| `#13131c`   | Hero, KPI, elevated card              |
| `border-default`   | `#1f1f2c`   | Default card border                   |
| `border-strong`    | `#2a2a3a`   | Hover / focus                         |
| `text-primary`     | `#f4f6fb`   | Headings                              |
| `text-body`        | `#d9dde5`   | Body prose                            |
| `text-muted`       | `#9aa0ad`   | Meta, captions                        |
| `text-subtle`      | `#6a6f7c`   | Labels, separators                    |
| `accent-green`     | `#10b981`   | Command Center / Client / Review      |
| `accent-cyan`      | `#06b6d4`   | Secondary metric                      |
| `accent-purple`    | `#a855f7`   | Free newsletter                       |
| `accent-amber`     | `#f59e0b`   | Premium newsletter                    |
| `accent-red`       | `#ef4444`   | Risk / alert                          |

Accent pairing matches the sending email. Daily Brief → `/command` = green.
Weekly Review → `/command/client/[slug]` = green. Free newsletter →
`/newsletter/[slug]` (free) = purple. Premium → amber.

### 3. Typography scale (locked).
- Display: `text-5xl md:text-6xl` — hero KPI value, ARR thermometer number.
- H1: `text-3xl md:text-4xl font-bold tracking-tight` — page titles.
- H2: `text-xl md:text-2xl font-semibold` — section headings (sparingly).
- Body: `text-base md:text-[17px] leading-[1.75]` — read-long prose.
- Meta mono: `text-[11px] font-mono uppercase tracking-[0.18em]` — eyebrows.
- Body content width: `max-w-3xl`. Never let prose run wider.
- Headings and CTAs may center; paragraphs always left-align.

### 4. Spacing scale (locked).
- Vertical rhythm: stack blocks at `space-y-6 md:space-y-8`.
- Section padding: `py-10 md:py-16`. Hero: `py-12 md:py-20`.
- Card padding: `p-6 md:p-8`.
- Outer gutter: `px-5 md:px-8`.
- Content container: `max-w-6xl mx-auto` for dashboard pages,
  `max-w-3xl mx-auto` for read-mode (newsletter).

### 5. Motion budget.
- Hero fade-in + slide-up on mount. Always. Use `motion.div` with
  `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}`.
- Live data: pulse the value briefly on update (no layout shift).
- No bouncing, no parallax, no confetti. Motion says "this is live" — nothing
  more. Over-motion reads as amateur.

---

## The Structure Contract (every linked-from-email page)

1. **`<PageShell accent>`** — outer canvas bg, scroll container, optional
   sticky top bar with live status dot.
2. **`<PageHero>`** — eyebrow (mono uppercase), H1 title, meta line, one-line
   lede, optional hero KPI (big number) or thermometer.
3. **`<KpiGrid>`** — 3–5 top-line KPIs in a spacious horizontal row. Values
   at display size. Labels tiny mono. One accent color only.
4. **`<SectionLabel>` + `<Card>`** — repeating content blocks. Mono uppercase
   label above each card. Cards have `bg-surface`, `border border-default`,
   `rounded-2xl`, generous padding.
5. **Primary content** — table, list, chart, or prose. Lives inside cards.
6. **CTA row** — at most two buttons: primary gradient pill, secondary
   outlined pill. Same visual rhythm across every page.
7. **`<PageFooter>`** — tagline + links. Always present. Always mono.

Missing #2, #3, or #4 → the page is incomplete. Having two hero KPIs or two
primary CTAs → cut one.

---

## What We Do NOT Do (web-side)

- ❌ Ship a linked page that's visibly less polished than the email that sent
  the user there. This is the single most important rule — it breaks trust.
- ❌ `display:grid` with mystery gaps instead of our spacing scale. Use the
  tokens; grids inherit their gap from `gap-6`.
- ❌ Raw `bg-black` / `bg-gray-950`. Always `bg-canvas`.
- ❌ Mixing accents within one page (purple heading + green button). One
  accent per page — pick it by sender.
- ❌ Text under `text-[14px]` for primary content. Dashboards may use mono
  `text-[11px]` for labels; prose never.
- ❌ Bullets for insight/analysis content. Insights are paragraphs. (Matches
  the email rule — the newsletter artifact at `docs/newsletter-structure.md`
  already codifies this; we do not contradict it on the web.)
- ❌ Floating decorative emoji on hero. One emoji, next to title, max.
- ❌ Horizontal scroll at any viewport ≥ 360px. Test at 375px before ship.

---

## Reverting Is Banned

If a future edit to any page linked from an email:
- replaces `<PageShell>` with a custom wrapper div, OR
- swaps a locked token for an arbitrary hex / gray shade, OR
- drops the hero → KPI → sections → CTA → footer structure, OR
- adds a competing accent color, OR
- shrinks the hero type below `text-3xl`

— the change must be rejected in review with a link to this document. The
correct solution is to extend `components/ui/web-primitives.tsx`, not to
bypass it in a caller.

The failure mode we are protecting against: "I tweaked one page to test
something" and the page now looks 2 tiers worse than the email that links to
it — the user clicks through from a Weekly Review email and lands on a
bland gray-on-gray table with mis-sized text. Every rule here exists because
that failure already happened at least once.

---

## Pages Currently Under Contract

| Email template             | Lands on                            | Accent  |
|----------------------------|-------------------------------------|---------|
| CEO Daily Brief            | `/command`                          | green   |
| Weekly Investor Review     | `/command/client/[slug]`            | green   |
| Interlinked Free           | `/newsletter/[slug]` (tier=free)    | purple  |
| Interlinked Premium        | `/newsletter/[slug]` (tier=premium) | amber   |

Every new transactional email that gets a CTA button MUST map to a page
listed here (or this table gets a new row and the page uses the primitives).

---

## Verification Before Shipping Page Changes

1. `npm run check` clean.
2. `npm run build` clean.
3. Open at 375px AND 1280px. No horizontal scroll. Hero KPI fits.
4. Click-through from the linked email — the page should feel one tier MORE
   premium than the email. If it feels equal or worse, cut the email's
   polish or raise the page's.
5. Data-loading state is a skeleton, not a bare spinner. Polling updates
   don't cause layout shift.
