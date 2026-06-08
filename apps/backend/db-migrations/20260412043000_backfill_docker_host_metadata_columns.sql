-- Backfill docker_hosts metadata columns required by ping and health polling

ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS agent_version text;

ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS os_info text;

ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS consecutive_failures integer;

ALTER TABLE public.docker_hosts
ALTER COLUMN consecutive_failures SET DEFAULT 0;

UPDATE public.docker_hosts
SET consecutive_failures = 0
WHERE consecutive_failures IS NULL;

ALTER TABLE public.docker_hosts
ALTER COLUMN consecutive_failures SET NOT NULL;

ALTER TABLE public.docker_hosts
ADD COLUMN IF NOT EXISTS last_error text;
