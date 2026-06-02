import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Server } from "lucide-react";

import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { HostUpgradeDialog } from "@/components/hosts/HostUpgradeDialog";
import { HostSidebar } from "@/components/hosts/HostSidebar";
import { SelectedHostView } from "@/components/hosts/SelectedHostView";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHostWorkspaceState } from "@/hooks/useHostWorkspaceState";
import {
  agentVerificationReason,
  buildAddHostDisabledReason,
  buildMetricsErrorMessage,
  formatHostMetricsFailure,
} from "./host-workspace-helpers";

export function HostWorkspace() {
  const queryClient = useQueryClient();
  const {
    hosts,
    filteredHosts,
    selectedHost,
    isLoading,
    search,
    setSearch,
    testing,
    isInfrastructureVisible,
    setIsInfrastructureVisible,
    upgradeDialogOpen,
    setUpgradeDialogOpen,
    nodeLimit,
    isHostLocked,
    handleSelectHost,
    handleTest,
    handleDelete,
    containers,
    runningCount,
    metricsQuery,
    containersQuery,
    missingExtendedMetrics,
    agentUpdateStatus,
    agentUpdateStatusCopy,
    currentOrg,
  } = useHostWorkspaceState();

  const addHostDisabledReason = buildAddHostDisabledReason(hosts.length, nodeLimit);
  const metricsFailureDisplay = formatHostMetricsFailure(metricsQuery.failure, selectedHost);
  const metricsErrorMessage = buildMetricsErrorMessage(metricsQuery.failure);
  const liveRefreshPending = containersQuery.isFetching || metricsQuery.isFetching;
  const verificationReason = agentVerificationReason(metricsQuery.failure, missingExtendedMetrics);
  const showAgentUpdateCta = !!selectedHost && agentUpdateStatus !== "current";

  const selectedPreviewMetrics = metricsQuery.latestPoint
    ? { cpu: metricsQuery.latestPoint.cpu, memory: metricsQuery.latestPoint.memory }
    : null;

  const handleRefreshLiveData = async () => {
    await Promise.allSettled([containersQuery.refetch(), metricsQuery.refetch()]);
    await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Hosts"
        description={hosts.length > 0 ? `${hosts.length} host(s) configured` : "Connect Docker hosts to monitor"}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Hosts" }]}
        actions={currentOrg ? <AddHostDialog orgId={currentOrg.id} disabledReason={addHostDisabledReason} /> : undefined}
      />

      {hosts.length === 0 ? (
        <div className="glass-card p-6 sm:p-12 text-center">
          <div className="mx-auto mb-4 sm:mb-5 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary">
            <Server className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-1 sm:mb-2">No Docker hosts connected</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
            Connect a Docker host via a lightweight agent or Cloudflare Tunnel. No open Docker ports needed.
          </p>
          {currentOrg && <AddHostDialog orgId={currentOrg.id} trigger={<Button size="sm" className="sm:size-default">Connect Your First Host</Button>} />}
        </div>
      ) : (
        <div className={cn("grid gap-4 sm:gap-6", isInfrastructureVisible ? "lg:grid-cols-[300px,minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]")}>
          {isInfrastructureVisible ? (
            <HostSidebar
              filteredHosts={filteredHosts}
              selectedHost={selectedHost}
              selectedPreviewMetrics={selectedPreviewMetrics}
              search={search}
              onSearchChange={setSearch}
              onSelectHost={handleSelectHost}
              onHideSidebar={() => setIsInfrastructureVisible(false)}
              isHostLocked={isHostLocked}
            />
          ) : null}

          {selectedHost ? (
            <SelectedHostView
              selectedHost={selectedHost}
              containers={containers}
              runningCount={runningCount}
              orgId={currentOrg?.id}
              testing={testing}
              liveRefreshPending={liveRefreshPending}
              selectedHostAutoProbe={metricsQuery.latestPoint !== undefined}
              selectedHostDisconnected={!selectedHost.status || selectedHost.status === 'disconnected'}
              selectedHostStale={selectedHost.status === 'stale'}
              selectedHostReadable={selectedHost.status !== 'disconnected'}
              missingExtendedMetrics={missingExtendedMetrics}
              metricsQuery={metricsQuery}
              containersQuery={containersQuery}
              metricsFailureDisplay={metricsFailureDisplay}
              metricsErrorMessage={metricsErrorMessage}
              agentUpdateStatus={agentUpdateStatus}
              agentUpdateStatusCopy={agentUpdateStatusCopy}
              verificationReason={verificationReason}
              showAgentUpdateCta={showAgentUpdateCta}
              isInfrastructureVisible={isInfrastructureVisible}
              addHostDisabledReason={addHostDisabledReason}
              onShowSidebar={() => setIsInfrastructureVisible(true)}
              onTest={handleTest}
              onRefreshLiveData={() => void handleRefreshLiveData()}
              onDelete={handleDelete}
            />
          ) : (
            <div className="glass-card p-6 sm:p-10 text-center text-xs sm:text-sm text-muted-foreground">Select a host to view its details.</div>
          )}
        </div>
      )}

      <HostUpgradeDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen} nodeLimit={nodeLimit} />
    </div>
  );
}
