-- Persistent editorial classifications across database and file-backed issues.
-- This does not publish, enqueue, enroll, or send an issue.
CREATE TABLE public.portfolio_newsletter_classifications (
  source_id text NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  post_key text NOT NULL CHECK (length(post_key) <= 320 AND post_key ~ '^(newsletter|federation|success|leadfranchise|newsroom|imperium|static):[^[:space:]]+$'),
  niche text NOT NULL CHECK (niche ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) BETWEEN 0 AND 100 AND array_position(tags, NULL) IS NULL),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, post_key)
);

ALTER TABLE public.portfolio_newsletter_classifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portfolio_newsletter_classifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_newsletter_classifications TO service_role;

COMMENT ON TABLE public.portfolio_newsletter_classifications IS
  'Owner-managed niche and tags for the portfolio newsletter catalog. Native content remains authoritative. Server-only; no client policies.';
COMMENT ON COLUMN public.portfolio_newsletter_classifications.post_key IS
  'Namespace plus immutable native id: newsletter:<uuid>, federation:<uuid>, success:<uuid>, leadfranchise:<uuid>, newsroom:<uuid>, imperium:<uuid>, or static:<slug>.';
