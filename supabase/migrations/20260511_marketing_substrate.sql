-- ─────────────────────────────────────────────────────────────────────
-- 20260511_marketing_substrate.sql
-- Federation Marketing System — owner-network newsletters + brand-deal
-- funnels. Five new tables; service_role-only RLS; auto-seed of
-- federation_owners from operator + Rene + omni_businesses.
--
-- Sends are driven by lib/business-marketing.ts using these tables.
-- See app/api/marketing/{campaign,runner}/route.ts for HTTP surfaces
-- and app/dashboard/marketing/page.tsx for the operator console.
-- ─────────────────────────────────────────────────────────────────────


-- ── federation_owners ───────────────────────────────────────────────
-- Enriched mailing roster. Hand-curated layer that sits ON TOP of
-- omni_businesses — pulls forward owner contact_email but lets the
-- operator add non-business contacts (Kimberly @ Alira, Jana, partners)
-- and fix derived first names. Audience for every owner_network
-- campaign send.
CREATE TABLE IF NOT EXISTS public.federation_owners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  first_name      text NOT NULL,
  email           text NOT NULL UNIQUE,
  role            text NOT NULL DEFAULT 'owner',
    -- 'operator' | 'owner' | 'partner' | 'staff'
  business_slugs  text[] NOT NULL DEFAULT '{}',
  notes           text,
  opted_in_at     timestamptz NOT NULL,
  unsubscribed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federation_owners_active
  ON public.federation_owners (email)
  WHERE unsubscribed_at IS NULL;

ALTER TABLE public.federation_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.federation_owners;
CREATE POLICY service_role_all
  ON public.federation_owners
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── marketing_landings ──────────────────────────────────────────────
-- Per-business product / brand-deal landing pages. Rendered at
-- /p/<business_slug>/<slug>. body_md is operator-authored prose;
-- the page wraps it in the case-study cosmic-background template.
CREATE TABLE IF NOT EXISTS public.marketing_landings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_slug   text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('product','brand_deal')),
  slug            text NOT NULL UNIQUE,
  headline        text NOT NULL,
  subhead         text,
  hero_visual_url text,
  body_md         text,
  cta_label       text,
  cta_url         text,
  price           text,
  share_pct       numeric,
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_landings_business
  ON public.marketing_landings (business_slug, status);

ALTER TABLE public.marketing_landings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.marketing_landings;
CREATE POLICY service_role_all
  ON public.marketing_landings
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── marketing_campaigns ─────────────────────────────────────────────
-- A campaign = one landing page + one audience kind + one sender persona.
-- sender_email's domain MUST match a Resend-verified domain or
-- enqueueCampaign rejects.
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_slug     text NOT NULL,
  landing_id        uuid REFERENCES public.marketing_landings(id) ON DELETE SET NULL,
  kind              text NOT NULL CHECK (kind IN ('product','brand_deal')),
  subject_template  text NOT NULL,
  body_md_template  text NOT NULL,
  sender_display    text NOT NULL,
  sender_email      text NOT NULL,
  reply_to_email    text NOT NULL,
  audience_kind     text NOT NULL
    CHECK (audience_kind IN ('owner_network','brand_deal_prospects')),
  daily_throttle    integer NOT NULL DEFAULT 200,
  hourly_throttle   integer NOT NULL DEFAULT 25,
  status            text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_business
  ON public.marketing_campaigns (business_slug, status);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.marketing_campaigns;
CREATE POLICY service_role_all
  ON public.marketing_campaigns
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── marketing_sends ─────────────────────────────────────────────────
-- One row per (campaign, recipient). enqueueCampaign creates rows with
-- scheduled_at set; runScheduledSends fires them and records resend_id.
-- Engagement columns (opened_at, clicked_at, …) populated by the
-- Resend webhook handler keyed on resend_id.
CREATE TABLE IF NOT EXISTS public.marketing_sends (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  recipient_email       text NOT NULL,
  recipient_first_name  text,
  scheduled_at          timestamptz NOT NULL,
  sent_at               timestamptz,
  resend_id             text,
  opened_at             timestamptz,
  clicked_at            timestamptz,
  complained_at         timestamptz,
  bounced_at            timestamptz,
  unsubscribed_at       timestamptz,
  suppressed_reason     text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_due
  ON public.marketing_sends (scheduled_at)
  WHERE sent_at IS NULL AND suppressed_reason IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_sends_resend
  ON public.marketing_sends (resend_id)
  WHERE resend_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign_sent
  ON public.marketing_sends (campaign_id, sent_at DESC);

ALTER TABLE public.marketing_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.marketing_sends;
CREATE POLICY service_role_all
  ON public.marketing_sends
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── brand_deal_prospects ────────────────────────────────────────────
-- Apollo-discovered / manually-entered prospects who'd potentially
-- sponsor a federation slot. Every row starts as 'pending_approval' —
-- selectAudience only pulls 'approved' so operator gate is enforced.
-- CSV import path requires consent_proof_url (no purchased lists).
CREATE TABLE IF NOT EXISTS public.brand_deal_prospects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_business_slug  text NOT NULL,
  prospect_email        text NOT NULL,
  first_name            text,
  company               text,
  role                  text,
  source                text NOT NULL CHECK (source IN ('apollo','manual','csv')),
  consent_proof_url     text,
  status                text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected','sent')),
  discovery_payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (source <> 'csv' OR consent_proof_url IS NOT NULL),
  CONSTRAINT brand_deal_prospects_unique_target_email
    UNIQUE (target_business_slug, prospect_email)
);

CREATE INDEX IF NOT EXISTS idx_brand_deal_prospects_target_status
  ON public.brand_deal_prospects (target_business_slug, status);

ALTER TABLE public.brand_deal_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.brand_deal_prospects;
CREATE POLICY service_role_all
  ON public.brand_deal_prospects
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── seed: federation_owners ─────────────────────────────────────────

-- 1. Operator + direct-owner row ($Mafi).
--    Sitani Mafi personally owns: imperium + all three news properties
--    (beehive, wasatch, utah-main) + acts as operator across every
--    federation domain. Single row covers both roles via business_slugs.
INSERT INTO public.federation_owners (full_name, first_name, email, role, business_slugs, opted_in_at, notes)
VALUES (
  'Sitani Mafi', 'Sitani', 'sitanim8@gmail.com', 'operator',
  ARRAY['imperium','beehive','wasatch','utah-main',
        'rene','ltb','udb','psych','youngs','alira'],
  now(),
  'Operator + direct owner of imperium + news properties. Greeting uses real first name "Sitani".'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Known third-party owner emails (operator-confirmed). Hard-coded
--    because some omni_businesses rows use generic ops@ inboxes rather
--    than the owner's personal address — these override the auto-seed.
INSERT INTO public.federation_owners (full_name, first_name, email, role, business_slugs, opted_in_at, notes) VALUES
  ('Rene Laveau', 'Rene', 'renelaveau@gmail.com', 'owner', ARRAY['rene'], now(), 'Sacred Letters operator')
ON CONFLICT (email) DO NOTHING;

-- 3. Backfill from omni_businesses — pulls any business with a
--    contact_email we don't already have a row for. first_name derived
--    from name's first token; operator edits later if it's a brand
--    name rather than a real first name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'omni_businesses'
  ) THEN
    INSERT INTO public.federation_owners
      (full_name, first_name, email, role, business_slugs, opted_in_at, notes)
    SELECT b.name,
           split_part(b.name, ' ', 1),
           lower(b.contact_email),
           'owner',
           ARRAY[b.slug],
           now(),
           'Auto-seeded from omni_businesses 2026-05-11 — verify first_name'
    FROM   public.omni_businesses b
    WHERE  b.contact_email IS NOT NULL
      AND  b.slug IS NOT NULL
      AND  lower(b.contact_email) NOT IN (SELECT email FROM public.federation_owners)
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;
