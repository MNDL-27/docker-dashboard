import { sql } from "./db.mjs";

let schemaEnsured = false;

export async function ensureAgentEnrollmentSchema() {
  if (schemaEnsured) return;

  const tbls = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'agent_enrollment_sessions'
  `;
  if (tbls.length > 0) {
    schemaEnsured = true;
    return;
  }

  await sql`
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
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE public.agent_enrollment_sessions
    DROP CONSTRAINT IF EXISTS agent_enrollment_sessions_status_check
  `;

  await sql`
    ALTER TABLE public.agent_enrollment_sessions
    ADD CONSTRAINT agent_enrollment_sessions_status_check
    CHECK (status IN ('created', 'claimed', 'installed', 'expired', 'cancelled'))
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_enrollment_token_hash
    ON public.agent_enrollment_sessions (enrollment_token_hash)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_enrollment_org_status
    ON public.agent_enrollment_sessions (organization_id, status, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_enrollment_host
    ON public.agent_enrollment_sessions (docker_host_id)
  `;

  await sql`
    DROP TRIGGER IF EXISTS update_agent_enrollment_sessions_updated_at ON public.agent_enrollment_sessions
  `;

  await sql`
    CREATE TRIGGER update_agent_enrollment_sessions_updated_at
    BEFORE UPDATE ON public.agent_enrollment_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  schemaEnsured = true;
}
