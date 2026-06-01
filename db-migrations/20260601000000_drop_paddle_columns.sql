-- 20260601000000_drop_paddle_columns.sql
-- Remove Paddle payment provider columns from organizations table.
-- Paddle has been fully removed from the codebase; billing is now
-- handled via Liberapay/PayPal donation webhooks and manual admin reconciliation.

DROP INDEX IF EXISTS idx_organizations_paddle_subscription_id;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS paddle_subscription_id,
  DROP COLUMN IF EXISTS paddle_customer_id,
  DROP COLUMN IF EXISTS paddle_price_id;
