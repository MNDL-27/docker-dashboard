-- 20260413010000_add_alert_webhook_destinations.sql
-- Persist org-scoped webhook destinations and alert delivery attempts.

CREATE TABLE IF NOT EXISTS public.webhook_destinations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  signing_secret text NOT NULL,
  signing_secret_preview text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_destinations_org_enabled
  ON public.webhook_destinations (organization_id, enabled, created_at DESC);

CREATE TABLE IF NOT EXISTS public.alert_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_destination_id uuid NOT NULL REFERENCES public.webhook_destinations(id) ON DELETE CASCADE,
  alert_event_id uuid REFERENCES public.alert_events(id) ON DELETE SET NULL,
  delivery_kind text NOT NULL DEFAULT 'alert',
  event_type text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  http_status integer,
  error_summary text,
  response_excerpt text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_delivery_attempts_kind_check CHECK (delivery_kind IN ('alert', 'test'))
);

CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_destination_time
  ON public.alert_delivery_attempts (webhook_destination_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_alert_time
  ON public.alert_delivery_attempts (alert_event_id, attempted_at DESC);

DROP TRIGGER IF EXISTS update_webhook_destinations_updated_at ON public.webhook_destinations;
CREATE TRIGGER update_webhook_destinations_updated_at
BEFORE UPDATE ON public.webhook_destinations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
