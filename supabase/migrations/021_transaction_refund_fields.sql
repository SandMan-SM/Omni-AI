-- ── 021_transaction_refund_fields ──────────────────────────────────────────
-- Adds the fields the Stripe `charge.refunded` webhook handler wants to
-- write but the 017 schema can't hold.
--
-- Context:
--   app/api/webhooks/stripe/route.ts → handleChargeRefunded() needs to
--   distinguish full vs partial refunds and record the refunded amount +
--   timestamp. Without these columns the webhook can only stamp the
--   status back to 'refunded' and lose the partial-refund delta.
--
--   This migration does two things:
--   1. Adds 'partially_refunded' to the transactions.status CHECK.
--   2. Adds refunded_amount (NUMERIC) + refunded_at (TIMESTAMPTZ).
--
--   Once applied, flip the webhook handler's UPDATE block to set
--   status = (isFullRefund ? 'refunded' : 'partially_refunded'),
--   refunded_amount = refundedAmount, refunded_at = now.

-- Drop the old CHECK (we don't know its exact name; find-and-drop).
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%CHECK%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Re-add with 'partially_refunded' included.
ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partially_refunded'));

-- New columns. IF NOT EXISTS so this migration is idempotent if someone
-- reruns it by mistake.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Optional index — refund lookups by date for reconciliation reports.
CREATE INDEX IF NOT EXISTS idx_transactions_refunded_at
  ON transactions(refunded_at)
  WHERE refunded_at IS NOT NULL;

COMMENT ON COLUMN transactions.refunded_amount IS 'Total refunded amount (subset of amount for partials, equal to amount for full).';
COMMENT ON COLUMN transactions.refunded_at IS 'Timestamp of the most recent refund event.';
