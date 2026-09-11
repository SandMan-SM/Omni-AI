# Success Empire Daily Newsletter Runbook

## Purpose

Success Empire publishes two daily website editions and uses email, Telegram,
RSS, and the newsletter landing page as teaser channels that drive readers back
to `https://sitanimafi.com`.

- Morning: principle and application guide.
- Afternoon: an actual-day personal letter linked to the morning principle.
- Email recipient: `sitanim8@gmail.com` only unless the owner explicitly
  authorizes a broader audience.

The editorial standard lives in
`docs/success-empire-editorial-system.md`.

## Canonical components

Database project: `odvxtychuxxsudfpcqqs`

- `public.success_empire_entries`
- `public.success_empire_delivery_attempts`

Public users can select published article columns only. Generation context,
sender addresses, errors, and delivery receipts remain service-role only.

Hermes source:

- `ops/hermes-success-empire/success-empire-daily.py`

Installed Hermes aliases:

- `~/.hermes/scripts/success-empire-morning.py`
- `~/.hermes/scripts/success-empire-afternoon.py`
- `~/.hermes/scripts/success-empire-monitor.py`
- `~/.hermes/scripts/success-empire-daily.py` for diagnostics

Website routes:

- `/newsletter/daily`
- `/newsletter/principles/[slug]`
- `/newsletter/daily/[slug]`

## Hermes schedules

All three jobs are script-only and deliver their receipts locally. The script
itself handles Resend and Telegram so provider receipts can be persisted in the
database.

| Job | ID | Schedule, Mountain Time |
| --- | --- | --- |
| Morning principle | `632dab563366` | `15 7 * * *` |
| Afternoon letter gate | `0ab84967d4f8` | `*/5 15-17 * * *` |
| Daily repair monitor | `08a529379bed` | `15 18 * * *` |

The afternoon target is selected once per date with an HMAC and always falls
between 3:05 PM and 5:55 PM in a five-minute slot. Repeated scheduler ticks
before the target are silent no-ops. Ticks after a successful publication are
idempotent no-ops.

The obsolete agent-driven weekly personal memo job `f2c183fed52a` is paused. Do
not resume it; it conflicts with this system and uses the retired voice and
artifact format.

## Sender identities

- Morning: `Success Empire <newsletter@sitanimafi.com>`
- Afternoon: `Sitani Mafi <CEO@sitanimafi.com>`
- Reply-to: `sitanim8@gmail.com`

The sending domain must remain verified in Resend. Email sending stops if the
recipient suppression lookup fails or returns a suppression.

## Delivery contract

Before any new article is generated or published, the workflow verifies:

1. Supabase service-role access.
2. Resend API access and verified `sitanimafi.com` domain.
3. Suppression-list lookup.
4. Telegram bot authentication.
5. Success Empire channel identity and bot administrator/post permission.

After generation:

1. The editorial rubric must score at least 85/100 and pass every hard gate.
2. The draft is stored, marked published, and then fetched from its public
   website URL.
3. The public page must contain the exact title.
4. Only then may email and Telegram send.
5. Each channel persists a stable idempotency key and real provider receipt.

Stable email key:

`success-empire/{principle|journal}/YYYY-MM-DD/v1`

Stable Telegram key:

`success-empire/telegram/{principle|journal}/YYYY-MM-DD/v1`

Published article content is immutable. A retry repairs only a missing channel.

## Teaser rules

Email, Telegram, and the new RSS items contain the title, short deck, and
website button/link only. They must not contain article section headings,
article paragraphs, internal labels, source context, generation receipts, raw
markdown, or production details.

The afternoon Telegram post has two buttons:

1. Read the Full Letter.
2. Today's Morning Principle.

## Diagnostics

Safe, no-write checks:

```text
~/.hermes/scripts/success-empire-daily.py check
~/.hermes/scripts/success-empire-daily.py telegram-check
~/.hermes/scripts/success-empire-daily.py target
~/.hermes/scripts/success-empire-daily.py context
```

Manual execution must use the installed aliases or explicit commands only after
the production site and all provider checks are healthy.

## Recovery

- `401 Unauthorized` from Telegram means the configured bot credential is
  revoked or invalid. Replace the credential through the normal Hermes Telegram
  setup flow; never search unrelated project secret files for another token.
- A wrong Telegram title fails closed. Configure the numeric ID for the channel
  whose title is exactly `Success Empire`.
- A recent `pending` delivery attempt is treated as in-flight for 15 minutes to
  prevent a retry race.
- A provider rejection is persisted as `failed` or `suppressed`; it never
  returns success.
- The 6:15 PM monitor reruns only missing work and fails loudly if either daily
  edition is not published with both channels accepted.

## Release rules

Follow the federation protocol before a database migration or deployment.
Deploy database dependencies first, then `sitanimafi.com`, then activate a real
publication. Use the exact source of the current production deployment, never a
dirty folder inferred from its name.

The Utah Main Street daily-events workflow is a reference for reliability only.
It is outside this system and must not be edited.
