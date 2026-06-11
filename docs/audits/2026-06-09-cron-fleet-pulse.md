# Cron fleet pulse — 2026-06-09T02:01Z

Sanitized OmniClaw supervisor handoff. No secret values included.

## Scope
- Live cron health endpoint: `https://omnileadsagi.com/api/cron-log`
- Public growth surface: `https://omnileadsagi.com`
- Newsletter archive/API
- Federation health/cross-ad/council public probes
- Local Omni AI Website checkout at `/workspace`

## Findings
1. Cron fleet source of truth is currently unreadable even with the configured `OMNI_CRON_LOG_SECRET` loaded locally.
   - `GET /api/cron-log?status=error&hours=24&limit=10` returned `504` with `code: cron_runs_query_timeout`.
   - `GET /api/cron-log?hours=24&limit=10` returned `504` with `code: cron_runs_query_timeout`.
   - Per operating rule, this is classified as storage/query-layer observability, not another wrapper redeploy target.
2. Error ledger is blocked with the locally configured `CRON_SECRET`.
   - `GET /api/system/error-ledger?limit=50` returned `401 Unauthorized`.
   - Because ledger access is blocked, this local pulse is the sanitized handoff record.
3. Newsletter public data appears stale.
   - `GET /api/newsletter/posts` returned 53 posts, newest visible `published_at` = `2026-06-01T08:04:00-06:00`.
   - `/newsletter` renders and does not show `No issues yet`, but the newest issue is over a week old.
   - Cron-log timeout prevents confirming whether the newsletter generator job has successful rows in its expected window.
4. Runtime retry path is blocked in this scheduled container.
   - `omniclaw` CLI not found.
   - `hermes` CLI not found.
   - Cannot run `omniclaw cron run "<job name>"` or `hermes cron run "<job name>"` from here.
5. Public smoke checks passed for availability/content, with data gaps:
   - `/api/health` returned `200` JSON `status: ok`.
   - `/` returned `200` HTML with expected Omni AI title/content.
   - `/newsletter` returned `200` HTML with expected title/H1 and newsletter content; no empty-state text.
   - `/interlinked` returned `200` HTML with expected Interlinked content.
   - `/api/federation/health` returned `200` but `data_status: needs_data_connection`, warning `supabase_select_unavailable_or_timed_out`.
   - `/api/cross-ads` returned `200` but `data_status: needs_data_connection`, warning `select_failed`.
   - `/api/council/leaderboard` returned `200` but `data_status: needs_data_connection`, warning `select_failed`.
6. Local repo safety state:
   - Branch `main` is ahead of `origin/main` by 2 commits: `be082b6 Fix Interlinked hydration mismatches`, `8af3550 Fix newsletter posts production query fallback`.
   - Worktree has multiple unrelated modified/untracked files already present.
   - TypeScript check passed: `ALLOW_DIRTY_WORKTREE=1 npm run check:dirty` → `tsc` exit 0.

## Next safe action
Prepare/approve the storage-layer repair for `cron_runs` observability instead of re-deploying route wrappers:
- Add/verify an index supporting the supervisor query pattern: recent `created_at` scans with optional `status` filter.
- Consider a small latest-run rollup table/materialized view keyed by `job_name` for daily/window checks.
- Restore/verify error-ledger cron/admin auth so future defects can be written to the permanent ledger.
- Restore CLI/runtime access for scheduled containers (`omniclaw` or `hermes`) so retry-once automation can actually run jobs.

## Boundaries observed
- No Supabase migrations run.
- No `.env` files modified.
- No social/client-facing posts sent.
- No deploy attempted because cron-log points to storage/query-layer repair and the worktree is dirty/ahead with unrelated changes.
