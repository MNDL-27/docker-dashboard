
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
DROP TRIGGER IF EXISTS update_docker_hosts_updated_at ON public.docker_hosts;
DROP TRIGGER IF EXISTS update_docker_host_secrets_updated_at ON public.docker_host_secrets;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_docker_hosts_updated_at
  BEFORE UPDATE ON public.docker_hosts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_docker_host_secrets_updated_at
  BEFORE UPDATE ON public.docker_host_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
