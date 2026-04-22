import { sql } from './db.mjs';

let schemaEnsured = false;

/**
 * Runtime-safe schema backfill for docker host metadata.
 *
 * Why this exists:
 * - Production or local DBs can be behind the current schema.
 * - Host ping and health polling now persist agent_version and related fields.
 * - We guarantee those columns exist before read/write paths execute.
 */
export async function ensureDockerHostSchema() {
  if (schemaEnsured) return;

  await sql`
    ALTER TABLE public.docker_hosts
    ADD COLUMN IF NOT EXISTS agent_version text
  `;

  await sql`
    ALTER TABLE public.docker_hosts
    ADD COLUMN IF NOT EXISTS os_info text
  `;

  await sql`
    ALTER TABLE public.docker_hosts
    ADD COLUMN IF NOT EXISTS consecutive_failures integer
  `;

  await sql`
    ALTER TABLE public.docker_hosts
    ALTER COLUMN consecutive_failures SET DEFAULT 0
  `;

  await sql`
    UPDATE public.docker_hosts
    SET consecutive_failures = 0
    WHERE consecutive_failures IS NULL
  `;

  await sql`
    ALTER TABLE public.docker_hosts
    ALTER COLUMN consecutive_failures SET NOT NULL
  `;

  await sql`
    ALTER TABLE public.docker_hosts
    ADD COLUMN IF NOT EXISTS last_error text
  `;

  await sql`
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
    )
  `;

  schemaEnsured = true;
}
