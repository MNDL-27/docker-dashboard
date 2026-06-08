-- 20260413000000_add_alerts_workspace.sql
-- Persist alert rules, alert events, and incidents for the alerts workspace.

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  condition_type text NOT NULL,
  resource_scope jsonb NOT NULL DEFAULT '{"scope":"organization"}'::jsonb,
  threshold_value numeric,
  threshold_window_minutes integer NOT NULL DEFAULT 5,
  severity text NOT NULL DEFAULT 'warning',
  notification_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_condition_type_check CHECK (condition_type IN ('host_offline', 'container_exited', 'container_restart_loop', 'cpu_usage', 'memory_usage')),
  CONSTRAINT alert_rules_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT alert_rules_threshold_window_check CHECK (threshold_window_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled
  ON public.alert_rules (organization_id, enabled, created_at DESC);

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  incident_id uuid,
  fingerprint text NOT NULL,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_events_source_type_check CHECK (source_type IN ('host', 'container', 'metric', 'system')),
  CONSTRAINT alert_events_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT alert_events_status_check CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_alert_events_org_status
  ON public.alert_events (organization_id, status, last_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_org_fingerprint_active
  ON public.alert_events (organization_id, fingerprint)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_alert_event_id uuid REFERENCES public.alert_events(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incidents_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT incidents_status_check CHECK (status IN ('open', 'investigating', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_org_status
  ON public.incidents (organization_id, status, opened_at DESC);

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events;
CREATE TRIGGER update_alert_events_updated_at
BEFORE UPDATE ON public.alert_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
