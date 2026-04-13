import { sql } from "./db.mjs";

let schemaEnsured = false;

export async function ensureAdminSchema() {
  if (schemaEnsured) return;

  await sql`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_approved boolean
  `;

  await sql`
    UPDATE public.users
    SET is_approved = true
    WHERE is_approved IS NULL
  `;

  await sql`
    ALTER TABLE public.users
    ALTER COLUMN is_approved SET DEFAULT true
  `;

  await sql`
    ALTER TABLE public.users
    ALTER COLUMN is_approved SET NOT NULL
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS plan text
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS subscription_status text
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS paddle_subscription_id text
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS paddle_customer_id text
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS paddle_price_id text
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS current_period_ends_at timestamptz
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz
  `;

  await sql`
    UPDATE public.organizations
    SET
      plan = COALESCE(plan, 'free'),
      subscription_status = COALESCE(subscription_status, 'inactive'),
      cancel_at_period_end = COALESCE(cancel_at_period_end, false),
      billing_updated_at = COALESCE(billing_updated_at, now())
    WHERE
      plan IS NULL
      OR subscription_status IS NULL
      OR cancel_at_period_end IS NULL
      OR billing_updated_at IS NULL
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN plan SET DEFAULT 'free'
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN subscription_status SET DEFAULT 'inactive'
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN cancel_at_period_end SET DEFAULT false
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN billing_updated_at SET DEFAULT now()
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.user_access_controls (
      user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      is_suspended boolean NOT NULL DEFAULT false,
      is_hard_disabled boolean NOT NULL DEFAULT false,
      suspension_reason text,
      internal_notes text,
      updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.organization_access_controls (
      organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
      is_locked boolean NOT NULL DEFAULT false,
      lock_reason text,
      plan_override text,
      subscription_status_override text,
      current_period_ends_at_override timestamptz,
      cancel_at_period_end_override boolean,
      updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.organization_user_bans (
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      reason text NOT NULL,
      created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.docker_host_admin_controls (
      host_id uuid PRIMARY KEY REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
      is_quarantined boolean NOT NULL DEFAULT false,
      quarantine_reason text,
      needs_reconnect boolean NOT NULL DEFAULT false,
      updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.admin_operation_runs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      operation_name text NOT NULL,
      scope_type text,
      scope_id text,
      status text NOT NULL DEFAULT 'completed',
      reason text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.admin_audit_log (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      actor_email text NOT NULL,
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      reason text NOT NULL,
      before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
      after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
      request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
    ON public.admin_audit_log (created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_operation_runs_created_at
    ON public.admin_operation_runs (created_at DESC)
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_user_access_controls_updated_at ON public.user_access_controls
  `;

  await sql`
    CREATE TRIGGER update_user_access_controls_updated_at
    BEFORE UPDATE ON public.user_access_controls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_organization_access_controls_updated_at ON public.organization_access_controls
  `;

  await sql`
    CREATE TRIGGER update_organization_access_controls_updated_at
    BEFORE UPDATE ON public.organization_access_controls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_docker_host_admin_controls_updated_at ON public.docker_host_admin_controls
  `;

  await sql`
    CREATE TRIGGER update_docker_host_admin_controls_updated_at
    BEFORE UPDATE ON public.docker_host_admin_controls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_admin_operation_runs_updated_at ON public.admin_operation_runs
  `;

  await sql`
    CREATE TRIGGER update_admin_operation_runs_updated_at
    BEFORE UPDATE ON public.admin_operation_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  schemaEnsured = true;
}
