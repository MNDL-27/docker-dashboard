
-- Drop the old TLS table
DROP TABLE IF EXISTS public.docker_host_tls;

-- Remove tls_enabled column, add new connection fields
ALTER TABLE public.docker_hosts DROP COLUMN IF EXISTS tls_enabled;
ALTER TABLE public.docker_hosts ADD COLUMN connection_mode text NOT NULL DEFAULT 'agent';
ALTER TABLE public.docker_hosts ADD COLUMN docker_socket_path text DEFAULT '/var/run/docker.sock';

-- Create secrets table (agent API keys, CF service tokens)
CREATE TABLE public.docker_host_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES public.docker_hosts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  agent_api_key text,
  cf_service_token_id text,
  cf_service_token_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docker_host_secrets ENABLE ROW LEVEL SECURITY;

-- No SELECT policy! Secrets are never returned to frontend.
-- INSERT/UPDATE/DELETE for org admins only
CREATE POLICY "Org admins can insert secrets" ON public.docker_host_secrets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));

CREATE POLICY "Org admins can update secrets" ON public.docker_host_secrets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));

CREATE POLICY "Org admins can delete secrets" ON public.docker_host_secrets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));

-- Add updated_at trigger for secrets table
CREATE TRIGGER update_docker_host_secrets_updated_at
  BEFORE UPDATE ON public.docker_host_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
