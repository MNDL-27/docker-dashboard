import { useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization, useOrganizationList } from "@clerk/react";
import { useDockerHosts, useContainers, useAllContainerStats } from "@/hooks/useDocker";
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
  // An active organization means the user definitely has one. Otherwise fall
  // back to the memberships count.
  const hasOrgs = !!currentOrg || (userMemberships.count ?? 0) > 0;
  // `listLoaded`/`orgLoaded` only signal that the Clerk client is ready — the
  // memberships list itself may still be fetching, during which `count` is 0.
  // Wait for that fetch too, otherwise the no-organization onboarding flashes
  // before the dashboard data appears.
  const orgLoading = !orgLoaded || !listLoaded || userMemberships.isLoading;

  const { data: hosts = [], isLoading: hostsLoading, isError: hostsError, error: hostsQueryError } = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const {
    data: containers = [],
    isLoading: containersLoading,
    isFetching: containersFetching,
    refetch: refetchContainers,
    error: containersError,
  } = useContainers(currentOrg?.id, hosts.length > 0, 30000);

  const {
    data: rawStats = [],
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useAllContainerStats(currentOrg?.id, hosts.length > 0, 15000);

  // Track whether we've ever successfully loaded containers so that
  // subsequent background refetches don't flash the skeleton UI.
  const hasLoadedOnce = useRef(false);
  if (containers.length > 0) hasLoadedOnce.current = true;
  const showContainerSkeleton = containersLoading && !hasLoadedOnce.current;

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
      rawStats={rawStats}
      containersLoading={showContainerSkeleton || statsLoading}
      isFetching={containersFetching || statsFetching}
      liveDataError={containersError instanceof Error ? containersError.message : null}
      fleetMetricsRefetchInterval={10000}
    />
  );
}
