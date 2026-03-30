-- ============================================================================
-- PHASE 2: Unified Events Table — Source of Truth for Intelligence
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'ai_agent', 'cron', 'webhook')),
  actor_id TEXT,

  -- WHAT
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  action TEXT NOT NULL,

  -- WHERE / ON WHAT
  target_type TEXT,
  target_id TEXT,

  -- CONTEXT
  page_url TEXT,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,

  -- MEASUREMENTS
  value_numeric NUMERIC(12,2),
  value_text TEXT,
  duration_ms INTEGER,

  -- METADATA (only for truly unstructured overflow)
  properties JSONB DEFAULT '{}',

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Core query indexes
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_events_target ON events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id) WHERE session_id IS NOT NULL;

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Service role full access events') THEN
    CREATE POLICY "Service role full access events" ON events FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can view own events') THEN
    CREATE POLICY "Users can view own events" ON events FOR SELECT USING (actor_id = auth.uid()::TEXT);
  END IF;
END $$;
