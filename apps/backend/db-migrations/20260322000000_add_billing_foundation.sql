-- 20260322000000_add_billing_foundation.sql
-- Add billing foundation to organizations table

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS paddle_subscription_id text UNIQUE,
ADD COLUMN IF NOT EXISTS paddle_customer_id text,
ADD COLUMN IF NOT EXISTS paddle_price_id text,
ADD COLUMN IF NOT EXISTS current_period_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for paddle lookup
CREATE INDEX IF NOT EXISTS idx_organizations_paddle_subscription_id ON public.organizations(paddle_subscription_id);

-- Update existing organizations to 'free' plan if they don't have one
UPDATE public.organizations SET plan = 'free' WHERE plan IS NULL;
UPDATE public.organizations SET subscription_status = 'active' WHERE plan = 'free' AND subscription_status = 'inactive';
