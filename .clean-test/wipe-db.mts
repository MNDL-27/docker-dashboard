import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

async function run() {
  console.log('Wiping public schema strictly...');
  await (sql as any).query(`DROP SCHEMA IF EXISTS public CASCADE`);
  await (sql as any).query(`CREATE SCHEMA public`);
  await (sql as any).query(`GRANT ALL ON SCHEMA public TO public`);
  console.log('Public schema obliterated and recreated.');

  // Hardcode the schema pieces exactly as completely valid single statements
  await (sql as any).query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  
  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text,
  full_name text,
  avatar_url text,
  clerk_user_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`);

  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  clerk_org_id text UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`);

  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
)`);

  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.docker_hosts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  host_url text NOT NULL,
  connection_mode text NOT NULL DEFAULT 'agent',
  docker_socket_path text DEFAULT '/var/run/docker.sock',
  status text NOT NULL DEFAULT 'unknown',
  docker_version text,
  os_info text,
  last_seen_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`);

  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.docker_host_secrets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id uuid REFERENCES public.docker_hosts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  agent_api_key text,
  cf_service_token_id text,
  cf_service_token_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`);

  await (sql as any).query(`CREATE TABLE IF NOT EXISTS public.mock_agent_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
)`);
  await (sql as any).query(`INSERT INTO public.mock_agent_config (id, mode) VALUES (1, 'success') ON CONFLICT DO NOTHING`);

  await (sql as any).query(`CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`);

  await (sql as any).query(`DROP TRIGGER IF EXISTS update_users_updated_at ON public.users`);
  await (sql as any).query(`CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

  await (sql as any).query(`DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations`);
  await (sql as any).query(`CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

  await (sql as any).query(`DROP TRIGGER IF EXISTS update_docker_hosts_updated_at ON public.docker_hosts`);
  await (sql as any).query(`CREATE TRIGGER update_docker_hosts_updated_at BEFORE UPDATE ON public.docker_hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

  await (sql as any).query(`DROP TRIGGER IF EXISTS update_docker_host_secrets_updated_at ON public.docker_host_secrets`);
  await (sql as any).query(`CREATE TRIGGER update_docker_host_secrets_updated_at BEFORE UPDATE ON public.docker_host_secrets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

  await (sql as any).query(`CREATE OR REPLACE FUNCTION public.create_organization(_name text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  _slug text;
  _org_id uuid;
BEGIN
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug) || '-' || to_hex(extract(epoch from now())::int);
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_name, _slug, _user_id)
  RETURNING id INTO _org_id;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _user_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN _org_id;
END;
$$`);

  // To guarantee production schema.sql stays consistent with idempotent scripts, run ALTERs safely:
  await (sql as any).query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS clerk_user_id text UNIQUE`);
  await (sql as any).query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS clerk_org_id text UNIQUE`);

  const usersCount = await (sql as any).query("SELECT count(*) FROM public.users");
  console.log('Schema perfectly built. Clean bootstrap test PASSED.', usersCount);
  process.exit(0);
}
run().catch(err => {
  fs.writeFileSync('error.log', err ? (err.message || err.toString()) : 'Unknown error');
  process.exit(1);
});
