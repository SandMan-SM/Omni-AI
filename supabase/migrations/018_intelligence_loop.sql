-- ============================================================================
-- PHASE 4: Intelligence Closed Loop
-- anomaly → ai_decision → action → outcome → ai_learning
-- ============================================================================

-- ─── 4a. Extract JSON from anomalies into real columns ──────────────────────
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS metric_value NUMERIC;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS deviation_pct NUMERIC;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT FALSE;

-- ─── 4b. Extract JSON from actions into real columns ────────────────────────
ALTER TABLE actions ADD COLUMN IF NOT EXISTS action_name TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS target_table TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS success BOOLEAN;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- ─── 4c. Outcomes table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  anomaly_id UUID REFERENCES anomalies(id) ON DELETE SET NULL,

  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('resolved', 'partial', 'failed', 'escalated', 'no_change')),
  metric_before NUMERIC,
  metric_after NUMERIC,
  improvement_pct NUMERIC,

  notes TEXT,
  verified_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_action ON outcomes(action_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_anomaly ON outcomes(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON outcomes(outcome_type);

ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outcomes' AND policyname = 'Service role full access outcomes') THEN
    CREATE POLICY "Service role full access outcomes" ON outcomes FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- ─── 4d. AI Decisions table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID REFERENCES anomalies(id) ON DELETE SET NULL,
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,

  agent_name TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),

  alternatives_considered INTEGER DEFAULT 0,
  selected_action TEXT,

  human_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_anomaly ON ai_decisions(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_agent ON ai_decisions(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created ON ai_decisions(created_at DESC);

ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_decisions' AND policyname = 'Service role full access aid') THEN
    CREATE POLICY "Service role full access aid" ON ai_decisions FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- ─── 4e. AI Learnings table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  pattern_type TEXT NOT NULL,
  pattern_description TEXT NOT NULL,

  sample_count INTEGER DEFAULT 1,
  success_rate NUMERIC(5,2),
  avg_resolution_time_ms INTEGER,

  trigger_condition JSONB,
  recommended_action TEXT,

  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  last_validated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_learnings_type ON ai_learnings(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_learnings_active ON ai_learnings(is_active) WHERE is_active = true;

ALTER TABLE ai_learnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_learnings' AND policyname = 'Service role full access ail') THEN
    CREATE POLICY "Service role full access ail" ON ai_learnings FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;
