import { useMemo } from "react";
import { useOrganization, useOrganizationList } from "@clerk/clerk-react";
import { useDockerHosts, useContainers } from "@/hooks/useDocker";
import { buildDashboardStats } from "@/lib/dashboard-summary";
import { DashboardLoadingState } from "@/components/dashboard/DashboardLoadingState";
import { DashboardNoOrganizationState } from "@/components/dashboard/DashboardNoOrganizationState";
import { DashboardEmptyHostsState } from "@/components/dashboard/DashboardEmptyHostsState";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default function DashboardPage() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const currentOrg = organization;
  const hasOrgs = userMemberships.count ? userMemberships.count > 0 : false;
  const orgLoading = !orgLoaded || !listLoaded;

  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id);
  const { data: containers = [], isLoading: containersLoading } = useContainers(currentOrg?.id, hosts.length > 0);

  const stats = useMemo(() => buildDashboardStats(hosts, containers), [hosts, containers]);

  if (orgLoading) {
    return <DashboardLoadingState />;
  }

  if (!hasOrgs) {
    return <DashboardNoOrganizationState />;
  }

  const isLoading = (hostsLoading || containersLoading) && hosts.length === 0;
  if (isLoading) {
    return <DashboardLoadingState />;
  }

  if (hosts.length === 0) {
    return <DashboardEmptyHostsState organizationName={currentOrg?.name} />;
  }

  return (
    <DashboardOverview
      organizationName={currentOrg?.name}
      organizationId={organization?.id ?? null}
      hosts={hosts}
      stats={stats}
      containersLoading={containersLoading}
    />
  );
}

