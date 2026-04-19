import { sql } from "./db.mjs";

let schemaEnsured = false;

export async function ensureDedicatedDeploymentSchema() {
  if (schemaEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS public.dedicated_deployments (
      organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
      reference_id text UNIQUE NOT NULL,
      plan_id text NOT NULL DEFAULT 'enterprise',
      status text NOT NULL DEFAULT 'intake_received',
      target_window_label text NOT NULL DEFAULT '3-5 business days',
      latest_update_note text NOT NULL DEFAULT 'Deployment brief accepted. Capacity review starts next.',
      intake_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      technical_owner_name text NOT NULL DEFAULT '',
      technical_owner_email text NOT NULL DEFAULT '',
      created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE public.dedicated_deployments
    DROP CONSTRAINT IF EXISTS dedicated_deployments_status_check
  `;

  await sql`
    ALTER TABLE public.dedicated_deployments
    ADD CONSTRAINT dedicated_deployments_status_check
    CHECK (status IN ('intake_received', 'capacity_reserved', 'provisioning', 'hardening', 'ready_for_handoff', 'active'))
  `;

  await sql`
    ALTER TABLE public.dedicated_deployments
    DROP CONSTRAINT IF EXISTS dedicated_deployments_plan_id_check
  `;

  await sql`
    ALTER TABLE public.dedicated_deployments
    ADD CONSTRAINT dedicated_deployments_plan_id_check
    CHECK (plan_id = 'enterprise')
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.dedicated_deployment_updates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      status text NOT NULL,
      note text NOT NULL,
      created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_dedicated_deployment_updates_org_created_at
    ON public.dedicated_deployment_updates (organization_id, created_at DESC)
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_dedicated_deployments_updated_at ON public.dedicated_deployments
  `;

  await sql`
    CREATE TRIGGER update_dedicated_deployments_updated_at
    BEFORE UPDATE ON public.dedicated_deployments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at()
  `;

  schemaEnsured = true;
}
