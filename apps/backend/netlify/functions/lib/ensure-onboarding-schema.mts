import { sql } from './db.mjs';

let schemaEnsured = false;

/**
 * Runtime-safe schema backfill for onboarding status.
 *
 * Why this exists:
 * - Local/dev DBs can be behind schema.sql.
 * - Onboarding relies on organizations.onboarding_status.
 * - We guarantee column existence before read/write paths execute.
 */
export async function ensureOnboardingSchema() {
  if (schemaEnsured) return;

  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'onboarding_status'
  `;
  if (cols.length > 0) {
    schemaEnsured = true;
    return;
  }

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS onboarding_status text
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN onboarding_status SET DEFAULT 'not_started'
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz
  `;

  await sql`
    UPDATE public.organizations
    SET onboarding_status = 'not_started'
    WHERE onboarding_status IS NULL
  `;

  const dockerHostsTable = await sql`
    SELECT to_regclass('public.docker_hosts') AS table_name
  `;

  if (dockerHostsTable[0]?.table_name) {
    await sql`
      UPDATE public.organizations o
      SET
        onboarding_status = 'completed',
        onboarding_completed_at = COALESCE(o.onboarding_completed_at, now())
      WHERE o.onboarding_status = 'not_started'
      AND EXISTS (
        SELECT 1 FROM public.docker_hosts h
        WHERE h.organization_id = o.id
      )
    `;
  }

  await sql`
    UPDATE public.organizations
    SET onboarding_skipped_at = COALESCE(onboarding_skipped_at, updated_at)
    WHERE onboarding_status = 'skipped' AND onboarding_skipped_at IS NULL
  `;

  await sql`
    UPDATE public.organizations
    SET onboarding_completed_at = COALESCE(onboarding_completed_at, updated_at)
    WHERE onboarding_status = 'completed' AND onboarding_completed_at IS NULL
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN onboarding_status SET NOT NULL
  `;

  await sql`
    ALTER TABLE public.organizations
    DROP CONSTRAINT IF EXISTS organizations_onboarding_status_check
  `;

  await sql`
    ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_onboarding_status_check
    CHECK (onboarding_status IN ('not_started', 'skipped', 'completed'))
  `;

  schemaEnsured = true;
}
