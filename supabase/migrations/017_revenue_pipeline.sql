-- ============================================================================
-- PHASE 3: Revenue & Pipeline — Deals, Transactions, Campaign Metrics
-- ============================================================================

-- ─── 3a. Deals / Pipeline ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  deal_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability INTEGER DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  actual_close_date DATE,

  source TEXT,
  source_id TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  stage_changed_at TIMESTAMPTZ DEFAULT NOW(),

  loss_reason TEXT,
  win_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_deals_profile ON deals(profile_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_campaign ON deals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at DESC);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'Service role full access deals') THEN
    CREATE POLICY "Service role full access deals" ON deals FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'Admins can manage deals') THEN
    CREATE POLICY "Admins can manage deals" ON deals FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

-- ─── 3b. Transactions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,

  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('one_time', 'subscription', 'refund', 'merch')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  product_type TEXT,
  product_id TEXT,

  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_profile ON transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_txn_deal ON transactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_paid ON transactions(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_stripe ON transactions(stripe_payment_intent_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Service role full access txn') THEN
    CREATE POLICY "Service role full access txn" ON transactions FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- ─── 3c. Campaign Metrics ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(date DESC);

ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_metrics' AND policyname = 'Service role full access cm') THEN
    CREATE POLICY "Service role full access cm" ON campaign_metrics FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- ─── 3d. Revenue Views ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_mrr AS
SELECT
  date_trunc('month', paid_at) AS month,
  SUM(amount) AS mrr,
  COUNT(DISTINCT profile_id) AS paying_customers
FROM transactions
WHERE status = 'completed' AND type = 'subscription'
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_pipeline AS
SELECT
  stage,
  COUNT(*) AS deal_count,
  SUM(deal_value) AS total_value,
  SUM(deal_value * probability / 100.0) AS weighted_value
FROM deals
WHERE stage NOT IN ('closed_won', 'closed_lost')
GROUP BY stage;

CREATE OR REPLACE VIEW v_client_revenue AS
SELECT
  p.id AS profile_id,
  p.name,
  p.email,
  p.business_name,
  COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS total_revenue,
  COUNT(t.id) FILTER (WHERE t.status = 'completed') AS transaction_count,
  MAX(t.paid_at) AS last_payment
FROM profiles p
LEFT JOIN transactions t ON t.profile_id = p.id
GROUP BY p.id, p.name, p.email, p.business_name;
