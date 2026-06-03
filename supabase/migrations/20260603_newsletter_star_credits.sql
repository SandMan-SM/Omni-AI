CREATE TABLE IF NOT EXISTS public.newsletter_star_credit_claims (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  reader_email text NOT NULL,
  newsletter_slug text NOT NULL,
  newsletter_title text NOT NULL,
  page_url text,
  ip_address inet,
  user_agent text,
  credit_awarded integer NOT NULL DEFAULT 5,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_star_credit_claims_user_slug_unique_idx
ON public.newsletter_star_credit_claims (user_id, newsletter_slug);

CREATE INDEX IF NOT EXISTS newsletter_star_credit_claims_user_claimed_idx
ON public.newsletter_star_credit_claims (user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS newsletter_star_credit_claims_email_claimed_idx
ON public.newsletter_star_credit_claims (lower(reader_email), claimed_at DESC);

CREATE TABLE IF NOT EXISTS public.newsletter_star_credit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid UNIQUE REFERENCES public.newsletter_star_credit_claims(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  reader_email text NOT NULL,
  newsletter_slug text NOT NULL,
  newsletter_title text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 5,
  reason text NOT NULL DEFAULT 'newsletter-star-credit',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_star_credit_events_user_slug_unique_idx
ON public.newsletter_star_credit_events (user_id, newsletter_slug);

CREATE INDEX IF NOT EXISTS newsletter_star_credit_events_user_created_idx
ON public.newsletter_star_credit_events (user_id, created_at DESC);
