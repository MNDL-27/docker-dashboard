
-- Drop ALL existing policies on all tables first
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- organizations
CREATE POLICY "Users can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can view org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "Admins can update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), id));
CREATE POLICY "Admins can delete org" ON public.organizations FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), id));

-- organization_members
CREATE POLICY "Members can view members" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins can add members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins can update members" ON public.organization_members FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Admins can remove members" ON public.organization_members FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

-- docker_hosts
CREATE POLICY "Org members can view hosts" ON public.docker_hosts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins can create hosts" ON public.docker_hosts FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Org admins can update hosts" ON public.docker_hosts FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Org admins can delete hosts" ON public.docker_hosts FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

-- docker_host_tls
CREATE POLICY "Org admins can insert TLS certs" ON public.docker_host_tls FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));
CREATE POLICY "Org admins can update TLS certs" ON public.docker_host_tls FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));
CREATE POLICY "Org admins can delete TLS certs" ON public.docker_host_tls FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.docker_hosts dh WHERE dh.id = host_id AND public.is_org_admin(auth.uid(), dh.organization_id)));

-- profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
