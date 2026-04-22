import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization, useOrganizationList } from "@clerk/clerk-react";
import { useDockerHosts, useContainers } from "@/hooks/useDocker";
import { useViewerState } from "@/hooks/useViewerState";
import { buildDashboardStats } from "@/lib/dashboard-summary";
import { isManualScanPlan, isScanQuotaExhausted } from "@/lib/scan-quota";
import { DashboardLoadingState } from "@/components/dashboard/DashboardLoadingState";
import { DashboardNoOrganizationState } from "@/components/dashboard/DashboardNoOrganizationState";
import { DashboardEmptyHostsState } from "@/components/dashboard/DashboardEmptyHostsState";
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
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;
  const manualScanMode = isManualScanPlan(effectivePlan, viewer?.active_org_scan_limit);
  const scanQuotaExhausted = isScanQuotaExhausted(viewer?.active_org_scan_limit, viewer?.active_org_scan_remaining);

  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id);
  const {
    data: containers = [],
    isLoading: containersLoading,
    isFetching: containersFetching,
    refetch: refetchContainers,
    error: containersError,
  } = useContainers(currentOrg?.id, hosts.length > 0, manualScanMode ? false : 30000);

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
      liveDataError={containersError instanceof Error ? containersError.message : null}
      scanQuotaPlan={effectivePlan}
      scanQuotaLimit={viewer?.active_org_scan_limit}
      scanQuotaUsed={viewer?.active_org_scan_used}
      scanQuotaRemaining={viewer?.active_org_scan_remaining}
      scanQuotaResetAt={viewer?.active_org_scan_reset_at}
      scanQuotaExhausted={scanQuotaExhausted}
      manualScanMode={manualScanMode}
      isRefreshingLiveData={containersFetching}
      fleetMetricsRefetchInterval={manualScanMode ? false : 10000}
      onRefreshLiveData={async () => {
        await Promise.allSettled([
          refetchContainers(),
          queryClient.invalidateQueries({ queryKey: ['fleet-metrics', currentOrg?.id] }),
        ]);
        await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      }}
    />
  );
}

