-- Step 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Users (Replaces Supabase auth.users & public.profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text,
  full_name text,
  avatar_url text,
  clerk_user_id text UNIQUE,
  onboarding_reminder_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS clerk_user_id text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_reminder_email_sent_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Step 3: Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  clerk_org_id text UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'skipped', 'completed')),
  onboarding_skipped_at timestamptz,
  onboarding_completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS clerk_org_id text UNIQUE;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_status text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.organizations
  ALTER COLUMN onboarding_status SET DEFAULT 'not_started';
UPDATE public.organizations
SET onboarding_status = 'not_started'
WHERE onboarding_status IS NULL;
ALTER TABLE public.organizations
  ALTER COLUMN onboarding_status SET NOT NULL;
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_onboarding_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_onboarding_status_check
  CHECK (onboarding_status IN ('not_started', 'skipped', 'completed'));

-- Backfill onboarding status from existing org activity:
-- if an org already has hosts, onboarding is considered completed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'docker_hosts'
  ) THEN
    UPDATE public.organizations o
    SET
      onboarding_status = 'completed',
      onboarding_completed_at = COALESCE(o.onboarding_completed_at, now())
    WHERE o.onboarding_status = 'not_started'
    AND EXISTS (
      SELECT 1 FROM public.docker_hosts h WHERE h.organization_id = o.id
    );
  END IF;
END
$$;

UPDATE public.organizations
SET onboarding_skipped_at = COALESCE(onboarding_skipped_at, updated_at)
WHERE onboarding_status = 'skipped' AND onboarding_skipped_at IS NULL;

UPDATE public.organizations
SET onboarding_completed_at = COALESCE(onboarding_completed_at, updated_at)
WHERE onboarding_status = 'completed' AND onboarding_completed_at IS NULL;

-- Billing & subscription columns (added via migrations)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS current_period_ends_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS donor_premium_expires_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS payment_provider text;

UPDATE public.organizations SET plan = 'free' WHERE plan IS NULL;
UPDATE public.organizations SET subscription_status = 'active' WHERE plan = 'free' AND subscription_status = 'inactive';

-- Step 4: Organization Members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Step 5: Docker Hosts
CREATE TABLE IF NOT EXISTS public.docker_hosts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  host_url text NOT NULL,
  connection_mode text NOT NULL DEFAULT 'agent',
  docker_socket_path text DEFAULT '/var/run/docker.sock',
  status text NOT NULL DEFAULT 'unknown',
  docker_version text,
  agent_version text,
  os_info text,
  last_seen_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docker_hosts ADD COLUMN IF NOT EXISTS runtime_type text NOT NULL DEFAULT 'docker';
ALTER TABLE public.docker_hosts DROP CONSTRAINT IF EXISTS docker_hosts_runtime_type_check;
ALTER TABLE public.docker_hosts ADD CONSTRAINT docker_hosts_runtime_type_check CHECK (runtime_type IN ('docker', 'podman'));
CREATE INDEX IF NOT EXISTS idx_docker_hosts_runtime_type ON public.docker_hosts (runtime_type);

-- Step 6: Docker Host Secrets (No selecting by frontend)
CREATE TABLE IF NOT EXISTS public.docker_host_secrets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id uuid REFERENCES public.docker_hosts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  agent_api_key text,
  cf_service_token_id text,
  cf_service_token_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Step 7: Mock Agent Config 
CREATE TABLE IF NOT EXISTS public.mock_agent_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.mock_agent_config (id, mode) VALUES (1, 'success') ON CONFLICT DO NOTHING;



-- Step 8: Update Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_docker_hosts_updated_at ON public.docker_hosts;
CREATE TRIGGER update_docker_hosts_updated_at BEFORE UPDATE ON public.docker_hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_docker_host_secrets_updated_at ON public.docker_host_secrets;
CREATE TRIGGER update_docker_host_secrets_updated_at BEFORE UPDATE ON public.docker_host_secrets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.agent_enrollment_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  docker_host_id uuid REFERENCES public.docker_hosts(id) ON DELETE SET NULL,
  host_name text NOT NULL,
  host_url text NOT NULL,
  connection_mode text NOT NULL DEFAULT 'agent',
  docker_socket_path text NOT NULL DEFAULT '/var/run/docker.sock',
  encrypted_agent_api_key text NOT NULL,
  encrypted_cf_service_token_id text,
  encrypted_cf_service_token_secret text,
  enrollment_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  installed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_enrollment_sessions_status_check
    CHECK (status IN ('created', 'claimed', 'installed', 'expired', 'cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_enrollment_token_hash ON public.agent_enrollment_sessions (enrollment_token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_enrollment_org_status ON public.agent_enrollment_sessions (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_enrollment_host ON public.agent_enrollment_sessions (docker_host_id);

DROP TRIGGER IF EXISTS update_agent_enrollment_sessions_updated_at ON public.agent_enrollment_sessions;
CREATE TRIGGER update_agent_enrollment_sessions_updated_at BEFORE UPDATE ON public.agent_enrollment_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Alerts workspace
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled ON public.alert_rules (organization_id, enabled, created_at DESC);

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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_events_org_status ON public.alert_events (organization_id, status, last_seen_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_org_fingerprint_active ON public.alert_events (organization_id, fingerprint) WHERE resolved_at IS NULL;

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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON public.incidents (organization_id, status, opened_at DESC);

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events;
CREATE TRIGGER update_alert_events_updated_at BEFORE UPDATE ON public.alert_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
CREATE INDEX IF NOT EXISTS idx_webhook_destinations_org_enabled ON public.webhook_destinations (organization_id, enabled, created_at DESC);

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
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_destination_time ON public.alert_delivery_attempts (webhook_destination_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_alert_time ON public.alert_delivery_attempts (alert_event_id, attempted_at DESC);

DROP TRIGGER IF EXISTS update_webhook_destinations_updated_at ON public.webhook_destinations;
CREATE TRIGGER update_webhook_destinations_updated_at BEFORE UPDATE ON public.webhook_destinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.slack_destinations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  webhook_url text NOT NULL,
  webhook_url_preview text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slack_destinations_org_enabled ON public.slack_destinations (organization_id, enabled, created_at DESC);

CREATE TABLE IF NOT EXISTS public.alert_slack_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slack_destination_id uuid NOT NULL REFERENCES public.slack_destinations(id) ON DELETE CASCADE,
  alert_event_id uuid REFERENCES public.alert_events(id) ON DELETE SET NULL,
  delivery_kind text NOT NULL DEFAULT 'alert',
  event_type text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  http_status integer,
  error_summary text,
  response_excerpt text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_slack_attempts_destination_time ON public.alert_slack_delivery_attempts (slack_destination_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_slack_attempts_alert_time ON public.alert_slack_delivery_attempts (alert_event_id, attempted_at DESC);

DROP TRIGGER IF EXISTS update_slack_destinations_updated_at ON public.slack_destinations;
CREATE TRIGGER update_slack_destinations_updated_at BEFORE UPDATE ON public.slack_destinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create organization and auto-add owner
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  _slug text;
  _org_id uuid;
BEGIN
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug) || '-' || to_hex(extract(epoch from now())::int);
  
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_name, _slug, _user_id)
  RETURNING id INTO _org_id;
  
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _user_id, 'owner')
  ON CONFLICT DO NOTHING;
  
  RETURN _org_id;
END;
$$;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_dismissals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_time ON public.notifications (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user ON public.notification_dismissals (user_id);

-- Step 10: Host Metrics & Cache Tables
-- These tables were introduced via runtime migrations and are now part of the canonical schema.

CREATE TABLE IF NOT EXISTS public.host_network_usage (
  host_id uuid NOT NULL REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
  month_bucket text NOT NULL,
  last_raw_rx double precision NOT NULL DEFAULT 0,
  last_raw_tx double precision NOT NULL DEFAULT 0,
  accumulated_rx double precision NOT NULL DEFAULT 0,
  accumulated_tx double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_id, month_bucket)
);

DROP TRIGGER IF EXISTS update_host_network_usage_updated_at ON public.host_network_usage;
CREATE TRIGGER update_host_network_usage_updated_at BEFORE UPDATE ON public.host_network_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.host_metrics_cache (
  host_id uuid NOT NULL REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
  collected_at timestamptz NOT NULL DEFAULT now(),
  cpu double precision,
  memory double precision,
  used_cores double precision,
  total_cores double precision,
  memory_used double precision,
  memory_limit double precision,
  network_in_bytes_per_sec double precision,
  network_out_bytes_per_sec double precision,
  network_monthly_total double precision,
  disk_read_bytes_per_sec double precision,
  disk_write_bytes_per_sec double precision,
  uptime_seconds bigint,
  disks jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY (host_id, collected_at)
);
CREATE INDEX IF NOT EXISTS idx_host_metrics_cache_host_time ON public.host_metrics_cache (host_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS public.container_list_cache (
  host_id uuid NOT NULL REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
  cached_at timestamptz NOT NULL DEFAULT now(),
  containers jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (host_id)
);

-- Step 11: Proxy Audit Log
CREATE TABLE IF NOT EXISTS public.proxy_audit_log (
  id bigserial PRIMARY KEY,
  organization_id text NOT NULL,
  actor_user_id text NOT NULL,
  action text NOT NULL,
  host_id text NOT NULL,
  container_id text,
  path text,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proxy_audit_log_org_created ON public.proxy_audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proxy_audit_log_host ON public.proxy_audit_log (host_id, created_at DESC);

-- Step 12: Security Tables
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_rate_limits_key_window ON public.security_rate_limits (key, window_start);

CREATE TABLE IF NOT EXISTS public.security_webhook_nonces (
  id bigserial PRIMARY KEY,
  nonce text NOT NULL UNIQUE,
  source_ip text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_webhook_nonces_nonce ON public.security_webhook_nonces (nonce);

-- Step 13: Admin & Access Control Tables
CREATE TABLE IF NOT EXISTS public.runtime_schema_markers (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_access_controls (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_suspended boolean NOT NULL DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_user_access_controls_updated_at ON public.user_access_controls;
CREATE TRIGGER update_user_access_controls_updated_at BEFORE UPDATE ON public.user_access_controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.organization_access_controls (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  lock_reason text,
  locked_at timestamptz,
  locked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  plan_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_organization_access_controls_updated_at ON public.organization_access_controls;
CREATE TRIGGER update_organization_access_controls_updated_at BEFORE UPDATE ON public.organization_access_controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.organization_user_bans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.docker_host_admin_controls (
  host_id uuid PRIMARY KEY REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
  is_quarantined boolean NOT NULL DEFAULT false,
  quarantine_reason text,
  quarantined_at timestamptz,
  reconnect_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_docker_host_admin_controls_updated_at ON public.docker_host_admin_controls;
CREATE TRIGGER update_docker_host_admin_controls_updated_at BEFORE UPDATE ON public.docker_host_admin_controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.admin_operation_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_operation_runs_target ON public.admin_operation_runs (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  before_state jsonb DEFAULT '{}'::jsonb,
  after_state jsonb DEFAULT '{}'::jsonb,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_time ON public.admin_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log (target_type, target_id, created_at DESC);

-- Step 14: Billing Tables
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_org_time ON public.billing_events (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.donor_email_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donor_email_deliveries_org_time ON public.donor_email_deliveries (organization_id, created_at DESC);

-- Step 15: Page Views
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_user_active ON public.page_views (user_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_org_active ON public.page_views (organization_id, last_active_at DESC);

-- Step 16: Dedicated Deployments
CREATE TABLE IF NOT EXISTS public.dedicated_deployments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  region text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_deployments_status_check CHECK (status IN ('pending', 'provisioning', 'active', 'failed', 'terminated')),
  CONSTRAINT dedicated_deployments_plan_id_check CHECK (plan_id IN ('starter', 'business', 'enterprise'))
);

CREATE TABLE IF NOT EXISTS public.dedicated_deployment_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_id uuid NOT NULL REFERENCES public.dedicated_deployments(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dedicated_deployment_updates_deploy ON public.dedicated_deployment_updates (deployment_id, created_at DESC);

DROP TRIGGER IF EXISTS update_dedicated_deployments_updated_at ON public.dedicated_deployments;
CREATE TRIGGER update_dedicated_deployments_updated_at BEFORE UPDATE ON public.dedicated_deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 17: Beta Allowlist
CREATE TABLE IF NOT EXISTS public.beta_allowlist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Note: runtime_schema_markers is used by ensure-*.mts modules to track which
-- runtime migrations have been applied. This table is the bridge between the
-- SQL migration files and the TypeScript runtime schema management.
