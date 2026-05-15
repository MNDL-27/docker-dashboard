-- 20260516000000_add_page_views_table.sql
-- Active-now page view heartbeat tracking.
-- Each active user upserts a row per (user_id, organization_id) pair,
-- bumping last_active_at. This lets us count "users active right now"
-- with a simple WHERE last_active_at > now() - interval '2 minutes'.

CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  path text NOT NULL DEFAULT '/',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_views_user_org
  ON public.page_views (user_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_page_views_last_active_at
  ON public.page_views (last_active_at);

CREATE INDEX IF NOT EXISTS idx_page_views_org_last_active
  ON public.page_views (organization_id, last_active_at);
