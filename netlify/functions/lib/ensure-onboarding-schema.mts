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

  await sql`
    ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS onboarding_status text
  `;

  await sql`
    ALTER TABLE public.organizations
    ALTER COLUMN onboarding_status SET DEFAULT 'not_started'
  `;

  await sql`
    UPDATE public.organizations
    SET onboarding_status = 'not_started'
    WHERE onboarding_status IS NULL
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
