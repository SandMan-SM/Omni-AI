-- ============================================================================
-- ELO Rating System for Business Agent Rankings
-- Auto-integrates with profiles — every business gets ranked
-- ============================================================================

-- Add ELO columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_rank TEXT DEFAULT 'unranked'
  CHECK (elo_rank IN ('diamond', 'gold', 'silver', 'bronze', 'unranked'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_wins INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_losses INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_peak INTEGER DEFAULT 1000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'active'
  CHECK (agent_status IN ('active', 'idle', 'dormant'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_elo_update TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_elo ON profiles(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_elo_rank ON profiles(elo_rank);

-- ELO ranking view
CREATE OR REPLACE VIEW v_agent_rankings AS
SELECT
  p.id,
  p.name,
  p.business_name,
  p.email,
  p.role,
  p.tier,
  p.crm_status,
  p.is_premium,
  p.is_admin,
  COALESCE(p.agent_name, p.business_name, p.name) AS agent_name,
  p.elo_rating,
  p.elo_rank,
  p.elo_wins,
  p.elo_losses,
  p.elo_streak,
  p.elo_peak,
  p.agent_status,
  p.gross_revenue,
  p.total_spent,
  p.purchase_count,
  p.created_at,
  p.last_elo_update,
  -- Computed fields
  CASE WHEN (p.elo_wins + p.elo_losses) > 0
    THEN ROUND(p.elo_wins::NUMERIC / (p.elo_wins + p.elo_losses) * 100, 1)
    ELSE 0
  END AS win_rate,
  RANK() OVER (ORDER BY p.elo_rating DESC) AS leaderboard_position
FROM profiles p
WHERE p.business_name IS NOT NULL
  AND p.role != 'admin'
ORDER BY p.elo_rating DESC;
