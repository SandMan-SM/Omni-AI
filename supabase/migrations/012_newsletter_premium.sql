-- Migration 012: Add premium subscription fields to newsletter_subscriptions
-- Adds tier, name, and Stripe fields for the Newsletter Studio

ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'subscribed'
    CHECK (subscription_tier IN ('subscribed', 'premium')),
  ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure email uniqueness for upsert operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'newsletter_subscriptions_email_key'
      AND conrelid = 'newsletter_subscriptions'::regclass
  ) THEN
    ALTER TABLE newsletter_subscriptions
      ADD CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email);
  END IF;
END$$;

-- Index for fast premium lookup (cron job uses this)
CREATE INDEX IF NOT EXISTS idx_newsletter_premium_active
  ON newsletter_subscriptions(subscription_tier, subscribed)
  WHERE subscribed = true;
