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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS clerk_user_id text UNIQUE;

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
