-- ─────────────────────────────────────────────────────────────────────
-- 20260502_hades_sentinel.sql
-- Hades — the Quantum Sentinel. Schema for secrets vault, threat log,
-- root audit log, and DR runbook tracking.
--
-- These tables persist across the system. UI/API surfaces follow as
-- the data accumulates. The migration is intentionally small so it
-- can ship before the autonomy loops that fill it.
-- ─────────────────────────────────────────────────────────────────────

-- ── secrets_inventory ───────────────────────────────────────────────
-- Catalog of every secret the platform holds. Hades rotates the
-- critical-tier ones every 90 days; everything else by policy.
CREATE TABLE IF NOT EXISTS public.secrets_inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,   -- e.g. RESEND_API_KEY, STRIPE_SECRET_KEY
  category        text NOT NULL,          -- 'auth' | 'payment' | 'email' | 'ai' | 'telegram' | 'storage' | 'misc'
  owner           text,                    -- 'hades' | 'platform' | 'client:<slug>'
  last_rotated_at timestamptz,
  rotation_policy text NOT NULL DEFAULT '90d',  -- ISO 8601 duration shorthand
  severity_if_leaked text NOT NULL DEFAULT 'high',
    -- 'low' | 'medium' | 'high' | 'critical'
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secrets_due
  ON public.secrets_inventory (last_rotated_at)
  WHERE rotation_policy IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_secrets_inventory_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_secrets_inventory_updated_at ON public.secrets_inventory;
CREATE TRIGGER trg_secrets_inventory_updated_at
  BEFORE UPDATE ON public.secrets_inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_secrets_inventory_updated_at();


-- ── hades_threat_log ────────────────────────────────────────────────
-- Every detected threat (auth fail brute-force, rate-limit breach,
-- suspicious payload) plus the decision Hades took (logged / blocked /
-- banned / escalated).
CREATE TABLE IF NOT EXISTS public.hades_threat_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip            inet,
  action        text NOT NULL,          -- 'auth_fail' | 'rate_limit' | 'sql_keyword' | 'xss_probe' | ...
  severity      text NOT NULL DEFAULT 'info',
    -- 'info' | 'low' | 'medium' | 'high' | 'critical'
  decision      text NOT NULL DEFAULT 'logged',
    -- 'logged' | 'blocked' | 'banned' | 'escalated' | 'frozen'
  payload_hash  text,
  details       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threat_log_severity_recent
  ON public.hades_threat_log (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_log_ip
  ON public.hades_threat_log (ip, created_at DESC) WHERE ip IS NOT NULL;


-- ── hades_root_audit ────────────────────────────────────────────────
-- Append-only log of every privileged action: admin login, secret
-- access, role change, prod deploy, DB migration, refund.
CREATE TABLE IF NOT EXISTS public.hades_root_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid,                  -- profile id (nullable for system actions)
  actor_label   text,                  -- 'system:cron-morning-digest' / 'admin:steve' / etc.
  action        text NOT NULL,         -- 'login' | 'secret_read' | 'role_change' | 'prod_deploy' | 'migration_apply' | 'refund'
  target_kind   text,                  -- 'profile' | 'secret' | 'business' | 'payment'
  target_id     text,
  result        text NOT NULL DEFAULT 'success',
    -- 'success' | 'failure' | 'denied'
  payload       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_root_audit_recent
  ON public.hades_root_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_audit_actor
  ON public.hades_root_audit (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;


-- ── hades_dr_log ────────────────────────────────────────────────────
-- Disaster-recovery checkpoint log. Daily logical backup, weekly PITR
-- restore-test outcomes, runbook drills.
CREATE TABLE IF NOT EXISTS public.hades_dr_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint    text NOT NULL,         -- 'daily_backup' | 'weekly_restore_test' | 'runbook_drill'
  status        text NOT NULL,          -- 'success' | 'partial' | 'failure'
  notes_md      text,
  metrics       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dr_log_recent
  ON public.hades_dr_log (created_at DESC);


-- ── Seed: minimal secrets inventory bootstrap ───────────────────────
-- Cataloging every known secret without ever storing the value.
INSERT INTO public.secrets_inventory (name, category, owner, severity_if_leaked, rotation_policy, notes)
VALUES
  ('SUPABASE_SERVICE_ROLE_KEY','auth','hades','critical','90d','Bypasses RLS — never expose to client.'),
  ('SUPABASE_ANON_KEY','auth','platform','medium','annual','Public-safe but still rotate yearly.'),
  ('RESEND_API_KEY','email','hades','high','90d','Sending reputation hangs on this; rotate carefully.'),
  ('STRIPE_SECRET_KEY','payment','hades','critical','90d','Live keys; immediate revoke on suspected leak.'),
  ('STRIPE_WEBHOOK_SECRET','payment','hades','high','annual','Validates Stripe webhook signatures.'),
  ('OPENAI_API_KEY','ai','hades','high','90d','Cap spend; rotate on usage anomaly.'),
  ('ANTHROPIC_API_KEY','ai','hades','high','90d','Cap spend; rotate on usage anomaly.'),
  ('TELEGRAM_BOT_TOKEN','telegram','hades','medium','annual','Per-business bots also live here.'),
  ('CRON_SECRET','auth','hades','high','90d','Vercel Cron auth gate. Rotate quarterly.')
ON CONFLICT (name) DO NOTHING;
