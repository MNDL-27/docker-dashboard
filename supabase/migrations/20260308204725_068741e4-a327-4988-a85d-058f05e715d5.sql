
-- Separate table for TLS credentials - NO SELECT policy for regular users
-- Only the edge function (via service_role_key) can read cert material
CREATE TABLE public.docker_host_tls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.docker_hosts(id) ON DELETE CASCADE,
  ca_cert text,
  client_cert text,
  client_key text,
  server_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(host_id)
);

ALTER TABLE public.docker_host_tls ENABLE ROW LEVEL SECURITY;

-- No SELECT policy: authenticated users CANNOT read cert material back
-- Service role (edge function) bypasses RLS to read certs

-- Allow org admins to INSERT certs for their hosts
CREATE POLICY "Org admins can insert TLS certs"
ON public.docker_host_tls FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.docker_hosts dh
    WHERE dh.id = host_id
    AND public.is_org_admin(auth.uid(), dh.organization_id)
  )
);

-- Allow org admins to UPDATE certs for their hosts
CREATE POLICY "Org admins can update TLS certs"
ON public.docker_host_tls FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.docker_hosts dh
    WHERE dh.id = host_id
    AND public.is_org_admin(auth.uid(), dh.organization_id)
  )
);

-- Allow org admins to DELETE certs for their hosts
CREATE POLICY "Org admins can delete TLS certs"
ON public.docker_host_tls FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.docker_hosts dh
    WHERE dh.id = host_id
    AND public.is_org_admin(auth.uid(), dh.organization_id)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_docker_host_tls_updated_at
  BEFORE UPDATE ON public.docker_host_tls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
