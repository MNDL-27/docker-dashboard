
CREATE OR REPLACE FUNCTION public.create_organization(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _slug text;
  _org_id uuid;
BEGIN
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug) || '-' || to_hex(extract(epoch from now())::int);
  
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_name, _slug, auth.uid())
  RETURNING id INTO _org_id;
  
  -- The trigger should handle member creation, but let's ensure it
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;
  
  RETURN _org_id;
END;
$$;
