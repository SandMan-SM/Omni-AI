-- Fast per-site dashboard cache for /dashboard live cockpit.
-- Raw inbound_<slug>_events tables can be slow for exact analytics reads;
-- dashboard views should read these cached rollups and let cron/jobs refresh.

CREATE TABLE IF NOT EXISTS public.operator_site_rollups (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_site_rollups_refreshed
  ON public.operator_site_rollups (refreshed_at DESC);

ALTER TABLE public.operator_site_rollups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'operator_site_rollups'
      AND policyname = 'Service role full access operator_site_rollups'
  ) THEN
    CREATE POLICY "Service role full access operator_site_rollups"
      ON public.operator_site_rollups
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_operator_site_rollups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operator_site_rollups_touch_updated_at
  ON public.operator_site_rollups;
CREATE TRIGGER trg_operator_site_rollups_touch_updated_at
  BEFORE UPDATE ON public.operator_site_rollups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_operator_site_rollups_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_operator_site_rollup(
  p_slug TEXT,
  p_label TEXT
)
RETURNS VOID AS $$
DECLARE
  events_table TEXT := 'inbound_' || p_slug || '_events';
  leads_table TEXT := 'inbound_' || p_slug || '_leads';
  bookings_table TEXT := 'inbound_' || p_slug || '_bookings';
  newsletter_table TEXT := 'inbound_' || p_slug || '_newsletter_events';
BEGIN
  EXECUTE format($sql$
    WITH params AS (
      SELECT NOW() - INTERVAL '7 days' AS since_7d,
             NOW() - INTERVAL '30 days' AS since_30d
    ),
    events30 AS MATERIALIZED (
      SELECT event_type, path, page_url, session_id, visitor_id, created_at
      FROM public.%I
      WHERE created_at >= (SELECT since_30d FROM params)
    ),
    top_pages AS (
      SELECT COALESCE(NULLIF(path, ''), NULLIF(page_url, ''), '/') AS page,
             COUNT(*)::int AS views
      FROM events30
      WHERE event_type = 'page_view'
      GROUP BY 1
      ORDER BY views DESC
      LIMIT 4
    ),
    recent_leads AS (
      SELECT full_name, email, created_at
      FROM public.%I
      ORDER BY created_at DESC
      LIMIT 4
    )
    INSERT INTO public.operator_site_rollups (slug, label, metrics, refreshed_at)
    SELECT
      $1::text,
      $2::text,
      jsonb_build_object(
        'pageViews30d', COALESCE((SELECT COUNT(*) FROM events30 WHERE event_type = 'page_view'), 0),
        'visitors30d', COALESCE((SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id)) FROM events30 WHERE COALESCE(visitor_id, session_id) IS NOT NULL), 0),
        'leads30d', COALESCE((SELECT COUNT(*) FROM public.%I WHERE created_at >= (SELECT since_30d FROM params)), 0),
        'leads7d', COALESCE((SELECT COUNT(*) FROM public.%I WHERE created_at >= (SELECT since_7d FROM params)), 0),
        'bookings30d', COALESCE((SELECT COUNT(*) FROM public.%I WHERE created_at >= (SELECT since_30d FROM params)), 0),
        'subscribers30d', COALESCE((SELECT COUNT(*) FROM public.%I WHERE created_at >= (SELECT since_30d FROM params) AND event_type = 'subscribe'), 0),
        'subscribers7d', COALESCE((SELECT COUNT(*) FROM public.%I WHERE created_at >= (SELECT since_7d FROM params) AND event_type = 'subscribe'), 0),
        'ctaClicks30d', COALESCE((SELECT COUNT(*) FROM events30 WHERE event_type IN ('cta_click', 'click')), 0),
        'formSubmits30d', COALESCE((SELECT COUNT(*) FROM events30 WHERE event_type = 'form_submit'), 0),
        'conversionRate', COALESCE(ROUND(
          (
            (SELECT COUNT(*)::numeric FROM events30 WHERE event_type = 'form_submit')
            / NULLIF((SELECT COUNT(*)::numeric FROM events30 WHERE event_type = 'page_view'), 0)
          ) * 100,
          1
        ), 0),
        'topPages', COALESCE((SELECT jsonb_agg(jsonb_build_object('page', page, 'views', views) ORDER BY views DESC) FROM top_pages), '[]'::jsonb),
        'recentLeads', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', full_name, 'email', email, 'createdAt', created_at) ORDER BY created_at DESC) FROM recent_leads), '[]'::jsonb)
      ),
      NOW()
    ON CONFLICT (slug) DO UPDATE SET
      label = EXCLUDED.label,
      metrics = EXCLUDED.metrics,
      refreshed_at = EXCLUDED.refreshed_at
  $sql$, events_table, leads_table, leads_table, leads_table, bookings_table, newsletter_table, newsletter_table)
  USING p_slug, p_label;
EXCEPTION
  WHEN undefined_table THEN
    INSERT INTO public.operator_site_rollups (slug, label, metrics, refreshed_at)
    VALUES (
      p_slug,
      p_label,
      jsonb_build_object(
        'pageViews30d', 0,
        'visitors30d', 0,
        'leads30d', 0,
        'leads7d', 0,
        'bookings30d', 0,
        'subscribers30d', 0,
        'subscribers7d', 0,
        'ctaClicks30d', 0,
        'formSubmits30d', 0,
        'conversionRate', 0,
        'topPages', '[]'::jsonb,
        'recentLeads', '[]'::jsonb
      ),
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      label = EXCLUDED.label,
      metrics = EXCLUDED.metrics,
      refreshed_at = EXCLUDED.refreshed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
