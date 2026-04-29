-- ============================================================
-- Add Container Runtime Type Support (Docker + Podman)
-- ============================================================

-- Add runtime_type column to docker_hosts
-- Values: 'docker' (default), 'podman'
ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS runtime_type text NOT NULL DEFAULT 'docker';

-- Add constraint to ensure only valid runtime types
ALTER TABLE public.docker_hosts
DROP CONSTRAINT IF EXISTS docker_hosts_runtime_type_check;

ALTER TABLE public.docker_hosts
ADD CONSTRAINT docker_hosts_runtime_type_check
CHECK (runtime_type IN ('docker', 'podman'));

-- Update docker_socket_path comment to reflect dual support
COMMENT ON COLUMN public.docker_hosts.docker_socket_path IS 
'Socket path for container runtime. Docker: /var/run/docker.sock, Podman: /run/podman/podman.sock (rootful) or /run/user/{uid}/podman/podman.sock (rootless)';

-- Add index for runtime type filtering
CREATE INDEX IF NOT EXISTS idx_docker_hosts_runtime_type 
ON public.docker_hosts(runtime_type);

-- Backfill existing hosts as 'docker' (they were created before this feature)
UPDATE public.docker_hosts
SET runtime_type = 'docker'
WHERE runtime_type IS NULL OR runtime_type = '';