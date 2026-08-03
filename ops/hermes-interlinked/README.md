# Hermes Interlinked daily reliability pipeline

This pipeline copies the working Utah Main Street separation of concerns while
leaving every Utah Main Street job and file untouched.

## Jobs

1. **07:10 — creative generator**
   - researches a fresh issue;
   - creates Free and Premium copy plus two original images;
   - emits a strict response bundle;
   - performs no Git, deploy, database, Telegram, or email mutations.
2. **08:00 — deterministic release**
   - parses and validates the generator bundle;
   - derives 1200×630 and 1024×1024 assets;
   - checks disk, Git, Supabase, Resend, Telegram, and federation registry;
   - uses Supabase's authenticated HTTPS API rather than the workstation's
     unreliable direct Postgres hostname;
   - acquires the required federation deploy lease;
   - validates an isolated `origin/main` worktree;
   - pushes the artwork to canonical `main`;
   - waits for the Git-triggered Vercel production deployment;
   - upserts exactly one published Free and Premium row;
   - verifies the live API, pages, and rasters;
   - writes the canonical artifact and posts the Telegram channel message.
3. **08:45 — owner email**
   - requires the canonical artifact and live pair;
   - validates 1200×630 hero and 1024×1024 share art;
   - checks the verified Resend sender domain;
   - sends once with a date-stable Resend idempotency key;
   - mirrors the provider receipt to both database rows.
4. **09:15 — health monitor**
   - stays silent when publication, Telegram, and email receipts are complete;
   - alerts the owner through Telegram and exits nonzero when any gate is missing.

## Safety and recovery

- Every mutation job is idempotent.
- Draft rows created by the Vercel fallback remain hidden until the deterministic
  publisher replaces their content and sets `status=published`.
- Assets deploy before database publication, so missing images never become
  public rows.
- `published_at` is anchored at local noon on the issue date so evening
  releases cannot render as tomorrow after crossing midnight UTC.
- Telegram uses its existing date key; email uses both a provider idempotency
  key and durable local/database receipts.
- A failed release leaves a red Hermes run and a preserved worktree path.
- The publisher never edits or deploys from the shared dirty checkout.
- Production deploys resolve `omnileadsagi.com` through `federation.surfaces`
  and require a federation lease. Service-role-only PostgREST wrappers expose
  those existing federation primitives to the host; anonymous calls are
  rejected.
- Vercel receipt parsing accepts either CLI output stream and still requires
  an exact Ready/Promoted commit plus the matching custom-domain deployment.

## Manual commands

```text
python3 interlinked-daily-release.py --prepare-only
python3 interlinked-daily-release.py
python3 interlinked-owner-email.py --check-only
python3 interlinked-owner-email.py
python3 interlinked-health-monitor.py
```
