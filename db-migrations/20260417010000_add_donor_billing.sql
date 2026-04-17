-- 20260417010000_add_donor_billing.sql
-- Donor-gated premium support (manual + webhook reconciliation)

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS donor_premium_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_provider text;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL,
  provider_event_id text,
  amount numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  verification_error text,
  matched boolean NOT NULL DEFAULT false,
  matched_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  matched_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  matched_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_provider_event_id
ON public.billing_events(provider, provider_event_id)
WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_events_unmatched
ON public.billing_events(matched, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_provider_received
ON public.billing_events(provider, received_at DESC);

CREATE TABLE IF NOT EXISTS public.donor_email_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  template text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_on date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_donor_email_deliveries_daily
ON public.donor_email_deliveries (organization_id, template, sent_on);

CREATE INDEX IF NOT EXISTS idx_donor_email_deliveries_org_time
ON public.donor_email_deliveries (organization_id, sent_at DESC);
