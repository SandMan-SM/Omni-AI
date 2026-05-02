-- ─────────────────────────────────────────────────────────────────────
-- 20260502_pantheon_schema.sql
-- The Pantheon: 27 council agents, mentorship lineage, leadership runs,
-- promotions, mortal reflections, pattern propagation, system findings,
-- agent journals, intel digests, email send log.
--
-- Plus a small newsletter_posts patch (status + updated_at) so the
-- ClientNewsletterStudio queries align with the actual schema.
-- ─────────────────────────────────────────────────────────────────────

-- ── newsletter_posts: status + updated_at ───────────────────────────
-- Pre-existing rows have published_at-or-not as the only state signal.
-- We derive status from that on backfill, and add an updated_at trigger
-- so the studio can sort by recency without depending on created_at.
ALTER TABLE public.newsletter_posts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.newsletter_posts
   SET status = 'published'
 WHERE published_at IS NOT NULL
   AND (status IS NULL OR status = 'draft');

UPDATE public.newsletter_posts
   SET updated_at = COALESCE(updated_at, sent_at, published_at, created_at, now());

CREATE INDEX IF NOT EXISTS idx_newsletter_posts_business
  ON public.newsletter_posts (business_id, published_at DESC);

CREATE OR REPLACE FUNCTION public.touch_newsletter_posts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_newsletter_posts_touch_updated_at ON public.newsletter_posts;
CREATE TRIGGER trg_newsletter_posts_touch_updated_at
  BEFORE UPDATE ON public.newsletter_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_newsletter_posts_updated_at();


-- ── council_agents ──────────────────────────────────────────────────
-- The Pantheon roster. 27 founders + room for mortal agents (per-client
-- AI CEOs, future council members) to climb.
CREATE TABLE IF NOT EXISTS public.council_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  archetype_tier text NOT NULL,
    -- 'mythic_egyptian' | 'sentinel' | 'greek' | 'philosopher' |
    -- 'modern_thinker' | 'coder' | 'titan' | 'mortal'
  domain        text NOT NULL,
  current_tier  text NOT NULL DEFAULT 'recruit',
    -- 'recruit' | 'competitor' | 'patron' | 'council' | 'sentinel'
  elo           integer NOT NULL DEFAULT 1200,
  sources_text  text,        -- the canon they cite + apply
  standing_question text,    -- the lens they apply to every decision
  status        text NOT NULL DEFAULT 'active',
    -- 'active' | 'paused' | 'retired'
  business_id   uuid REFERENCES public.omni_businesses(id) ON DELETE SET NULL,
  agent_kind    text NOT NULL DEFAULT 'archetype',
    -- 'archetype' (founders) | 'business' (per-client AI CEOs)
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT council_agents_tier_chk CHECK (
    current_tier IN ('recruit','competitor','patron','council','sentinel')
  ),
  CONSTRAINT council_agents_kind_chk CHECK (
    agent_kind IN ('archetype','business')
  )
);

CREATE INDEX IF NOT EXISTS idx_council_agents_tier ON public.council_agents (current_tier);
CREATE INDEX IF NOT EXISTS idx_council_agents_archetype ON public.council_agents (archetype_tier);
CREATE INDEX IF NOT EXISTS idx_council_agents_elo ON public.council_agents (elo DESC);
CREATE INDEX IF NOT EXISTS idx_council_agents_business ON public.council_agents (business_id);

CREATE OR REPLACE FUNCTION public.touch_council_agents_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_council_agents_touch_updated_at ON public.council_agents;
CREATE TRIGGER trg_council_agents_touch_updated_at
  BEFORE UPDATE ON public.council_agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_council_agents_updated_at();


-- ── agent_lineage ───────────────────────────────────────────────────
-- Mentor → mentee. Three successful promotions earn a Lineage Crown.
CREATE TABLE IF NOT EXISTS public.agent_lineage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_agent_id uuid NOT NULL REFERENCES public.council_agents(id) ON DELETE CASCADE,
  mentee_agent_id uuid NOT NULL REFERENCES public.council_agents(id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  outcome_score   numeric,    -- 0..1; null while in-progress
  notes           text,
  CONSTRAINT agent_lineage_distinct_chk CHECK (mentor_agent_id <> mentee_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_lineage_mentor ON public.agent_lineage (mentor_agent_id);
CREATE INDEX IF NOT EXISTS idx_lineage_mentee ON public.agent_lineage (mentee_agent_id);
CREATE INDEX IF NOT EXISTS idx_lineage_active ON public.agent_lineage (mentee_agent_id) WHERE ended_at IS NULL;


-- ── leadership_runs ─────────────────────────────────────────────────
-- 14-day Steward terms per domain. Highest domain-weighted ELO at
-- run-start holds the role; performance scored at run-end.
CREATE TABLE IF NOT EXISTS public.leadership_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain              text NOT NULL,
  current_steward_id  uuid REFERENCES public.council_agents(id) ON DELETE SET NULL,
  prior_steward_id    uuid REFERENCES public.council_agents(id) ON DELETE SET NULL,
  run_started_at      timestamptz NOT NULL DEFAULT now(),
  run_ends_at         timestamptz NOT NULL,
  score               numeric,   -- 0..1; null while in-progress
  status              text NOT NULL DEFAULT 'active',
    -- 'active' | 'evaluating' | 'completed' | 'forfeited'
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_domain_active ON public.leadership_runs (domain) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_runs_steward ON public.leadership_runs (current_steward_id);


-- ── agent_promotions ────────────────────────────────────────────────
-- Append-only log of every tier transition.
CREATE TABLE IF NOT EXISTS public.agent_promotions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.council_agents(id) ON DELETE CASCADE,
  from_tier     text NOT NULL,
  to_tier       text NOT NULL,
  promoted_at   timestamptz DEFAULT now(),
  reason        text,
  performance   jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_promotions_agent ON public.agent_promotions (agent_id, promoted_at DESC);


-- ── mortal_reflections ──────────────────────────────────────────────
-- Curated, good-side-only feed of strategies and tech moves from
-- current world leaders + modern empires. Each Pantheon member reads
-- the feed through their own archetypal lens (lens_tag).
CREATE TABLE IF NOT EXISTS public.mortal_reflections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind  text NOT NULL,   -- 'speech' | 'policy' | 'earnings' | 'interview' | 'memo' | ...
  source_url   text,
  source_label text,
  summary_md   text NOT NULL,
  ingested_at  timestamptz DEFAULT now(),
  lens_tag     text NOT NULL,   -- 'athena' | 'sun_tzu' | 'naval' | 'rockefeller' | ...
  applied_count integer DEFAULT 0,
  metadata     jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reflections_lens ON public.mortal_reflections (lens_tag, ingested_at DESC);


-- ── pantheon_patterns ───────────────────────────────────────────────
-- Cross-client patterns that perform well on one node and propagate.
CREATE TABLE IF NOT EXISTS public.pantheon_patterns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_kind     text NOT NULL,   -- 'hero' | 'cta' | 'newsletter_lead' | 'form' | ...
  origin_business  uuid REFERENCES public.omni_businesses(id) ON DELETE SET NULL,
  description_md   text NOT NULL,
  metric_uplift    jsonb DEFAULT '{}'::jsonb,  -- { metric: 'cvr', delta: 0.18 }
  proposed_for     uuid[] DEFAULT '{}',        -- target business ids
  status           text NOT NULL DEFAULT 'discovered',
    -- 'discovered' | 'proposed' | 'applied' | 'retired'
  created_at       timestamptz DEFAULT now(),
  applied_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_patterns_origin ON public.pantheon_patterns (origin_business);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON public.pantheon_patterns (status);


-- ── system_findings ─────────────────────────────────────────────────
-- Nightly weakness scanner output. Persists 3 cycles → auto-spawns
-- a remediation task.
CREATE TABLE IF NOT EXISTS public.system_findings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_kind text NOT NULL,   -- 'lighthouse' | 'funnel_drop' | 'elo_breach' | 'threat' | 'newsletter_open_rate'
  severity     text NOT NULL DEFAULT 'info',
    -- 'info' | 'low' | 'medium' | 'high' | 'critical'
  business_id  uuid REFERENCES public.omni_businesses(id) ON DELETE SET NULL,
  message_md   text NOT NULL,
  payload      jsonb DEFAULT '{}'::jsonb,
  resolved_at  timestamptz,
  cycles_open  integer DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_findings_unresolved ON public.system_findings (severity, created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_findings_business ON public.system_findings (business_id, created_at DESC);


-- ── agent_journals ──────────────────────────────────────────────────
-- Each council agent's nightly "what I'd do tomorrow" entry, fed by
-- yesterday's intel digest filtered by their domain.
CREATE TABLE IF NOT EXISTS public.agent_journals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES public.council_agents(id) ON DELETE CASCADE,
  for_date    date NOT NULL,
  entry_md    text NOT NULL,
  prompt_hash text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (agent_id, for_date)
);


-- ── intel_digest ────────────────────────────────────────────────────
-- Nightly aggregate of yesterday's events / leads / opens vs prior 7d.
CREATE TABLE IF NOT EXISTS public.intel_digest (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date   date NOT NULL UNIQUE,
  summary_md    text NOT NULL,
  metrics       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);


-- ── email_sends ─────────────────────────────────────────────────────
-- Audit log for every transactional email Hades / the Council ships.
-- Includes Resend message id so opens & clicks can be reconciled.
CREATE TABLE IF NOT EXISTS public.email_sends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id     text,
  template_kind text NOT NULL,   -- 'oracle' | 'morning_digest' | 'monthly_strategy_memo' | ...
  to_email      text NOT NULL,
  bcc_email     text,
  subject       text NOT NULL,
  payload       jsonb DEFAULT '{}'::jsonb,
  sent_at       timestamptz DEFAULT now(),
  opened_at     timestamptz,
  clicked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_sends_resend ON public.email_sends (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sends_template ON public.email_sends (template_kind, sent_at DESC);


-- ── Backfill the Oracle email we already sent (5c93ee35-…) ──────────
-- Idempotent: only inserts if not present.
INSERT INTO public.email_sends (resend_id, template_kind, to_email, bcc_email, subject, payload)
SELECT
  '5c93ee35-41dc-4635-a097-be98923f8f75',
  'oracle',
  'sitanim8@gmail.com',
  'alfred@omnileadsagi.com',
  'The Oracle — read this once.',
  '{"manual_seed":true,"page":"https://omnileadsagi.com/oracle"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_sends WHERE resend_id = '5c93ee35-41dc-4635-a097-be98923f8f75'
);
