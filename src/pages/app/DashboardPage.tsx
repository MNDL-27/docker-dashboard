import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization, useOrganizationList } from "@clerk/react";
import { useDockerHosts, useContainers } from "@/hooks/useDocker";
import { useViewerState } from "@/hooks/useViewerState";
import { buildDashboardStats } from "@/lib/dashboard-summary";
import { DashboardLoadingState } from "@/components/dashboard/DashboardLoadingState";
import { DashboardNoOrganizationState } from "@/components/dashboard/DashboardNoOrganizationState";
import { DashboardEmptyHostsState } from "@/components/dashboard/DashboardEmptyHostsState";
import { DashboardConnectionErrorState } from "@/components/dashboard/DashboardConnectionErrorState";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { data: viewer } = useViewerState();
  const { userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const currentOrg = organization;
  const hasOrgs = userMemberships.count ? userMemberships.count > 0 : false;
  const orgLoading = !orgLoaded || !listLoaded;

  const { data: hosts = [], isLoading: hostsLoading, isError: hostsError, error: hostsQueryError } = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const {
    data: containers = [],
    isLoading: containersLoading,
    isFetching: containersFetching,
    refetch: refetchContainers,
    error: containersError,
  } = useContainers(currentOrg?.id, hosts.length > 0, 30000);

  const stats = useMemo(() => buildDashboardStats(hosts, containers), [hosts, containers]);

  if (orgLoading) {
    return <DashboardLoadingState />;
  }

  if (!hasOrgs) {
    return <DashboardNoOrganizationState />;
  }

  if (hostsError) {
    const message = hostsQueryError instanceof Error ? hostsQueryError.message : undefined;
    return <DashboardConnectionErrorState organizationName={currentOrg?.name} errorMessage={message} />;
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
      liveDataError={containersError instanceof Error ? containersError.message : null}
      fleetMetricsRefetchInterval={10000}
    />
  );
}
