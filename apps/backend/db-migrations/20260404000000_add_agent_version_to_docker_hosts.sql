-- Add agent version tracking to docker hosts

ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS agent_version text;
