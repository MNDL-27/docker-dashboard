import { sql } from './db.mjs';

let schemaEnsured = false;

/**
 * Runtime-safe schema backfill for alerts workspace tables.
 *
 * Why this exists:
 * - Production or local DBs can be behind the current schema.sql.
 * - Alerts endpoints now depend on alert_rules, alert_events, and incidents.
 * - We guarantee those tables and key indexes/triggers exist before queries run.
 */
export async function ensureAlertsSchema() {
  if (schemaEnsured) return;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled
    ON public.alert_rules (organization_id, enabled, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_events_org_status
    ON public.alert_events (organization_id, status, last_seen_at DESC)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_org_fingerprint_active
    ON public.alert_events (organization_id, fingerprint)
    WHERE resolved_at IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidents_org_status
    ON public.incidents (organization_id, status, opened_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_destinations_org_enabled
    ON public.webhook_destinations (organization_id, enabled, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_destination_time
    ON public.alert_delivery_attempts (webhook_destination_id, attempted_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_alert_time
    ON public.alert_delivery_attempts (alert_event_id, attempted_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_slack_destinations_org_enabled
    ON public.slack_destinations (organization_id, enabled, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_slack_attempts_destination_time
    ON public.alert_slack_delivery_attempts (slack_destination_id, attempted_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_alert_slack_attempts_alert_time
    ON public.alert_slack_delivery_attempts (alert_event_id, attempted_at DESC)
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON public.alert_rules
  `;

  await sql`
    CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON public.alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_alert_events_updated_at ON public.alert_events
  `;

  await sql`
    CREATE TRIGGER update_alert_events_updated_at
    BEFORE UPDATE ON public.alert_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents
  `;

  await sql`
    CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_webhook_destinations_updated_at ON public.webhook_destinations
  `;

  await sql`
    CREATE TRIGGER update_webhook_destinations_updated_at
    BEFORE UPDATE ON public.webhook_destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_slack_destinations_updated_at ON public.slack_destinations
  `;

  await sql`
    CREATE TRIGGER update_slack_destinations_updated_at
    BEFORE UPDATE ON public.slack_destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  schemaEnsured = true;
}
