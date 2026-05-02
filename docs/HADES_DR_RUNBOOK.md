# HADES — Disaster Recovery Runbook

> Hades guards the realm. When the realm breaks, Hades restores it.

This runbook is the single source of truth for restoring Omni AI from
catastrophic failure. Read it once before you need it, then keep it
where it can be reached on a phone if your laptop is the thing that's
broken.

## Quick reference

| Surface | Where it lives | Who owns it |
|---|---|---|
| Database | Supabase project `odvxtychuxxsudfpcqqs` (Interlinked) | Hades |
| Web app | Vercel project `omni-ai` | Hades + Hephaestus |
| Email sending | Resend (`agent@omnileadsagi.com`) | Hades |
| DNS | Domain registrar of record for `omnileadsagi.com` | Hermes |
| Per-client tracker | Their Vercel projects (4× client repos) | Each client + Hephaestus |

## Backup posture

| Frequency | What | Where |
|---|---|---|
| Daily 03:00 UTC | Supabase logical dump (`pg_dump`) | `s3://omni-dr-backups/daily/<YYYY-MM-DD>.sql.gz` *(when configured)* |
| Continuous | Supabase Point-In-Time Recovery (PITR) — 7-day window on Pro plan | Supabase-native |
| Weekly Sun 22:00 UTC | Restore-test job: pull yesterday's logical dump into a staging project, run `SELECT count(*) FROM <critical tables>` | Logged to `hades_dr_log` (`checkpoint='weekly_restore_test'`) |
| Per-deploy | Vercel atomic snapshot of every successful build | Vercel-native; rollback in < 60s via dashboard |
| Per-secret-rotation | Old value retained in vault for 24h before destruction | Hades — `secrets_inventory` |

PITR is the primary path for "oh no" moments. Logical dumps are insurance
against PITR not working (e.g. Supabase outage during the recovery
window).

## Tier-0 incident: production database is wrong

Symptoms: data missing, data corrupted, schema drift no one shipped.

1. **Stop writes.** Pause the Vercel project (Vercel UI → Project →
   Settings → Pause) so Vercel cron and any inbound webhooks halt.
2. **Capture forensics.** Run `pg_dump` against the live DB into a
   timestamped file before doing anything destructive. This becomes
   evidence if the cause turns out to be malicious.
3. **PITR rollback.** In Supabase dashboard → Database → Backups →
   PITR, pick the timestamp ≤ 5 minutes before the incident. Restore
   creates a new project; promote it (or migrate connection strings).
4. **Smoke.** From the dashboard, hit `/api/council`,
   `/dashboard/command-center`, `/oracle` — confirm 200s with sane
   counts.
5. **Resume.** Unpause Vercel. Watch `hades_threat_log` and
   `system_findings` for 60 minutes.
6. **Postmortem.** Append a `hades_root_audit` row with `action='dr_pitr_restore'`
   and the lost-data window. Tell the affected clients within 24h
   (Carnegie's library: be honest, then rebuild).

## Tier-0 incident: Vercel deployment broken (404 / 500 site-wide)

1. Vercel dashboard → omni-ai → Deployments → previous green build →
   "Promote to Production". Sub-60-second restore.
2. If the bad build is on `main` and auto-deploy is on, also revert
   the offending commit on main: `git revert <sha>` and push.
3. Investigate. Don't redeploy until typecheck + manual smoke pass.

## Tier-1 incident: secret leaked

Detection: gitleaks pre-commit hook fires; or Hades sees a usage anomaly
(e.g. Resend key sending from an IP we don't own).

1. **Rotate immediately.** New value in the upstream provider (Stripe,
   Resend, Supabase, etc.). Old value revoked.
2. **Update Vercel env.** Promote the new value to `production`,
   `preview`, and `development`. Trigger a redeploy so the change takes.
3. **Local + per-client repos.** Update `.env` and any per-client `.env`
   that referenced it (CPS, LTB, Leifson, Youngs, plus the Interlinked
   Python layer if applicable).
4. **`secrets_inventory` row** — bump `last_rotated_at = now()`.
5. **`hades_root_audit` row** — `action='secret_rotated'`, payload
   `{ secret_name: '...', reason: 'leak' }`.

## Tier-1 incident: payment incident (suspected fraudulent charge)

NEVER initiate a refund without operator confirmation. Refunds are
explicit-consent actions; Hades only reads. Operator runs the refund
through the Stripe dashboard or `/dashboard/billing` UI; Hades logs
the audit row after the fact.

## Tier-2 incident: tracker silent for one brand

Symptoms: `inbound_<slug>_events` shows zero rows in last 30 minutes
when the public site has visible traffic.

1. Check `INBOUND_ORIGINS[slug]` in `lib/inbound-types.ts` — does it
   include the brand's actual production hostname? (Common cause when
   a brand switches subdomains.)
2. Check the brand's deployed bundle for the latest tracker commit.
3. Check Vercel logs on `/api/inbound/<slug>/events` for 4xx spikes —
   most likely CORS rejection.

## Quarterly Hades drills

Last Friday of each quarter, run a tabletop:
- Tier-0 PITR restore into staging, time-to-promote
- Secret-rotation dry-run (rotate `CRON_SECRET`; verify no cron breakage)
- Read-only staging promo: confirm Vercel rollback works under load

Log every drill to `hades_dr_log` (`checkpoint='runbook_drill'`).

## Contacts

| Role | Name | Channel |
|---|---|---|
| Founder | Sita | sitanim8@gmail.com |
| Operator | Alfred | alfred@omnileadsagi.com |
| Hades (autonomous) | n/a | Telegram alerts via the per-business bots |

---

*The realm holds because Hades watches. Read this once. Sleep.*
