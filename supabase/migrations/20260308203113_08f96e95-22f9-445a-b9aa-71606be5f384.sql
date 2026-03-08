
-- Step 1: Create tables first
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE public.docker_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  host_url text NOT NULL,
  tls_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unknown',
  docker_version text,
  os_info text,
  last_seen_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Security definer functions (tables exist now)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id) $$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner', 'admin')) $$;

-- Step 3: Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docker_hosts ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
CREATE POLICY "Members can view org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "Users can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), id));
CREATE POLICY "Admins can delete org" ON public.organizations FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), id));

CREATE POLICY "Members can view members" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can add members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins can update members" ON public.organization_members FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins can remove members" ON public.organization_members FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members can view hosts" ON public.docker_hosts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can create hosts" ON public.docker_hosts FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Org admins can update hosts" ON public.docker_hosts FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete hosts" ON public.docker_hosts FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

-- Step 5: Triggers
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION handle_new_organization();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_docker_hosts_updated_at BEFORE UPDATE ON public.docker_hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Helper function for member profiles
CREATE OR REPLACE FUNCTION public.get_org_member_profiles(_org_id uuid)
RETURNS TABLE (user_id uuid, full_name text, avatar_url text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT om.user_id, p.full_name, p.avatar_url, om.role, om.created_at AS joined_at
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.user_id = om.user_id
  WHERE om.organization_id = _org_id
  AND EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = auth.uid()
  )
$$;
