-- ============================================================================
-- PHASE 5: Extract business_metrics from JSON + PHASE 6: Cleanup
-- ============================================================================

-- ─── 5a. Add structured columns to business_metrics ─────────────────────────
ALTER TABLE business_metrics ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE business_metrics ADD COLUMN IF NOT EXISTS metric_value NUMERIC;
ALTER TABLE business_metrics ADD COLUMN IF NOT EXISTS metric_unit TEXT;
ALTER TABLE business_metrics ADD COLUMN IF NOT EXISTS dimension TEXT;
ALTER TABLE business_metrics ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_bm_name ON business_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_bm_timestamp ON business_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bm_category ON business_metrics(category);

-- ─── 5b. Add tags_array to artifacts ────────────────────────────────────────
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS tags_array TEXT[];

-- ─── 6a. Drop dead tables ──────────────────────────────────────────────────
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS user_campaigns;

-- ─── 6b. Standardize timestamps to TIMESTAMPTZ ─────────────────────────────
ALTER TABLE actions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE actions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE actions ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';
ALTER TABLE actions ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';

ALTER TABLE anomalies ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE anomalies ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE anomalies ALTER COLUMN resolved_at TYPE TIMESTAMPTZ USING resolved_at AT TIME ZONE 'UTC';

ALTER TABLE artifacts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE artifacts ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE business_metrics ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC';
ALTER TABLE business_metrics ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE business_metrics ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ─── 6c. Dashboard materialized view ────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM profiles) AS total_users,
  (SELECT COUNT(*) FROM profiles WHERE crm_status = 'lead') AS total_leads,
  (SELECT COUNT(*) FROM profiles WHERE lead_score = 'hot') AS hot_leads,
  (SELECT COUNT(*) FROM profiles WHERE crm_status = 'client') AS total_clients,
  (SELECT COUNT(*) FROM profiles WHERE is_premium = true AND newsletter_subscribed = true) AS premium_subscribers,
  (SELECT COUNT(*) FROM campaigns WHERE status = 'active') AS active_campaigns,
  (SELECT COUNT(*) FROM newsletter_sends) AS total_sends,
  (SELECT COUNT(*) FROM newsletter_posts WHERE tier = 'premium') AS premium_posts,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed') AS total_revenue,
  (SELECT COALESCE(SUM(deal_value * probability / 100.0), 0) FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost')) AS pipeline_value
WITH DATA;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_dashboard_metrics;
END;
$$ LANGUAGE plpgsql;
