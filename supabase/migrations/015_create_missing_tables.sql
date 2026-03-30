-- ============================================================================
-- PHASE 1: Create Missing Tables + Fix Broken + Add Indexes
-- Migration-safe: all IF NOT EXISTS / IF EXISTS guards
-- ============================================================================

-- ─── 1a. newsletter_subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  subscription_tier TEXT DEFAULT 'subscribed'
    CHECK (subscription_tier IN ('subscribed', 'premium', 'unsubscribed')),
  subscribed BOOLEAN DEFAULT TRUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subs_tier_active
  ON newsletter_subscriptions(subscription_tier, subscribed)
  WHERE subscribed = true;
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_email
  ON newsletter_subscriptions(email);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Allow public insert') THEN
    CREATE POLICY "Allow public insert" ON newsletter_subscriptions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Allow authenticated read') THEN
    CREATE POLICY "Allow authenticated read" ON newsletter_subscriptions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Service role full access ns') THEN
    CREATE POLICY "Service role full access ns" ON newsletter_subscriptions FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- ─── 1b. demo_bookings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  business_name TEXT,
  purpose TEXT,
  date TEXT,
  time TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_bookings_scheduled ON demo_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_email ON demo_bookings(email);

ALTER TABLE demo_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'demo_bookings' AND policyname = 'Service role full access db') THEN
    CREATE POLICY "Service role full access db" ON demo_bookings FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'demo_bookings' AND policyname = 'Public insert db') THEN
    CREATE POLICY "Public insert db" ON demo_bookings FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─── 1c. webinar_registrations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  session_date TEXT,
  session_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webinar_reg_email ON webinar_registrations(email);

ALTER TABLE webinar_registrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webinar_registrations' AND policyname = 'Service role full access wr') THEN
    CREATE POLICY "Service role full access wr" ON webinar_registrations FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webinar_registrations' AND policyname = 'Public insert wr') THEN
    CREATE POLICY "Public insert wr" ON webinar_registrations FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─── 1d. Add missing indexes to existing tables ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_log_profile ON activity_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);

CREATE INDEX IF NOT EXISTS idx_campaigns_profile ON campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_sent_at ON newsletter_sends(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_posts_published ON newsletter_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_posts_tier ON newsletter_posts(tier);
CREATE INDEX IF NOT EXISTS idx_newsletter_posts_slug ON newsletter_posts(slug);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_crm_status ON profiles(crm_status);
CREATE INDEX IF NOT EXISTS idx_profiles_newsletter ON profiles(newsletter_subscribed) WHERE newsletter_subscribed = true;
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON profiles(is_premium) WHERE is_premium = true;

CREATE INDEX IF NOT EXISTS idx_actions_anomaly ON actions(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(resolved);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_created ON anomalies(created_at DESC);

-- ─── 1e. Fix campaigns.budget TEXT → NUMERIC ────────────────────────────────
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2) DEFAULT 0;
UPDATE campaigns SET budget_amount = NULLIF(regexp_replace(budget, '[^0-9.]', '', 'g'), '')::NUMERIC
  WHERE budget IS NOT NULL AND budget_amount IS NULL;

-- ─── 1f. Add missing profile columns (referenced in code but may not exist) ─
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gross_revenue NUMERIC(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
