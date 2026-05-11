import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganization } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Terminal } from "lucide-react";

import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { HostUpgradeDialog } from "@/components/hosts/HostUpgradeDialog";
import { HostSidebar } from "@/components/hosts/HostSidebar";
import { SelectedHostView } from "@/components/hosts/SelectedHostView";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isReadableHostStatus, normalizeHostStatus } from "@/lib/host-health-state";
import { useDeleteDockerHost, useDockerHosts, useHostContainers } from "@/hooks/useDocker";
import { useHostMetricsHistory } from "@/hooks/useHostMetrics";
import { useViewerState } from "@/hooks/useViewerState";
import { useToast } from "@/hooks/use-toast";
import { dockerApi } from "@/services/docker-api";
import { sanitizeConnectionError } from "@/lib/error-sanitizer";
import { getWatchtowerAgentUpdateStatus } from "@/lib/agent-release";
import { PLAN_POLICY_BY_PLAN, normalizePlan } from "../../../shared/schema/plan-policy";
import {
  agentVerificationReason,
  buildAddHostDisabledReason,
  buildMetricsErrorMessage,
  buildPingToastDescription,
  formatHostMetricsFailure,
  isRunningContainer,
  resolveAgentUpdateCopy,
} from "./host-workspace-helpers";

export function HostWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: routeHostId } = useParams();
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const deleteHost = useDeleteDockerHost();
  const { data: hosts = [], isLoading, refetch } = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const [search, setSearch] = useState("");
  const [testing, setTesting] = useState(false);
  const [isInfrastructureVisible, setIsInfrastructureVisible] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;
  
  const normalizedPlan = normalizePlan(effectivePlan);
  const fallbackNodeLimit = PLAN_POLICY_BY_PLAN[normalizedPlan].nodeLimit;
  const nodeLimit = viewer?.entitlements ? viewer.entitlements.nodeLimit : fallbackNodeLimit;

  // Hosts sorted by creation date (oldest first) — matches backend enforcement order
  const hostsSortedByCreation = useMemo(() => {
    return [...hosts].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB || a.id.localeCompare(b.id);
    });
  }, [hosts]);

  // Set of host IDs that are allowed by the current plan's node limit
  const allowedHostIds = useMemo(() => {
    if (nodeLimit === null) return null; // unlimited
    const allowed = new Set<string>();
    for (let i = 0; i < Math.min(nodeLimit, hostsSortedByCreation.length); i++) {
      allowed.add(hostsSortedByCreation[i].id);
    }
    return allowed;
  }, [hostsSortedByCreation, nodeLimit]);

  const isHostLocked = useCallback((hostId: string) => {
    if (allowedHostIds === null) return false; // unlimited plan
    return !allowedHostIds.has(hostId);
  }, [allowedHostIds]);

  const addHostDisabledReason = buildAddHostDisabledReason(hosts.length, nodeLimit);

  const filteredHosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return hosts;
    return hosts.filter((host) =>
      [host.name, host.host_url, host.connection_mode, host.status, host.os_info || ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [hosts, search]);

  const selectedHost = useMemo(() => {
    if (routeHostId) return hosts.find((host) => host.id === routeHostId) ?? null;
    // Default selection: prefer first allowed host
    if (allowedHostIds !== null) {
      const firstAllowed = filteredHosts.find(h => allowedHostIds.has(h.id))
        ?? hosts.find(h => allowedHostIds.has(h.id));
      return firstAllowed ?? null;
    }
    return filteredHosts[0] ?? hosts[0] ?? null;
  }, [allowedHostIds, filteredHosts, hosts, routeHostId]);

  useEffect(() => {
    if (isLoading || !routeHostId) return;

    // Redirect away from locked hosts
    if (isHostLocked(routeHostId)) {
      const firstAllowed = hostsSortedByCreation.find(h => !isHostLocked(h.id));
      setUpgradeDialogOpen(true);
      navigate(firstAllowed ? `/app/hosts/${firstAllowed.id}` : "/app/hosts", { replace: true });
      return;
    }

    if (selectedHost) return;

    if (hosts.length === 0) {
      navigate("/app/hosts", { replace: true });
      return;
    }

    navigate(`/app/hosts/${filteredHosts[0]?.id ?? hosts[0].id}`, { replace: true });
  }, [filteredHosts, hosts, hostsSortedByCreation, isHostLocked, isLoading, navigate, routeHostId, selectedHost]);

  const selectedHostReadable = isReadableHostStatus(selectedHost?.status);
  const selectedHostDisconnected = !isReadableHostStatus(selectedHost?.status);
  const selectedHostAutoProbe = normalizeHostStatus(selectedHost?.status) === "connected";
  const selectedHostStale = normalizeHostStatus(selectedHost?.status) === "stale";

  const selectedHostLocked = selectedHost ? isHostLocked(selectedHost.id) : false;
  const containersQuery = useHostContainers(selectedHostAutoProbe && !selectedHostLocked ? selectedHost?.id : null, 15000);
  const metricsQuery = useHostMetricsHistory(selectedHostAutoProbe && !selectedHostLocked ? selectedHost?.id : null, {
    enabled: selectedHostAutoProbe && !selectedHostLocked,
    refetchInterval: 10000,
    maxDataPoints: 24,
  });
  const metricsFailureDisplay = formatHostMetricsFailure(metricsQuery.failure, selectedHost);
  const selectedPreviewMetrics = metricsQuery.latestPoint
    ? { cpu: metricsQuery.latestPoint.cpu, memory: metricsQuery.latestPoint.memory }
    : null;
  const missingUptimeMetric = !!metricsQuery.latestPoint && metricsQuery.latestPoint.uptimeSeconds === null;
  const missingDiskMetrics = !!metricsQuery.latestPoint && metricsQuery.latestPoint.disks.length === 0;
  const missingExtendedMetrics = missingUptimeMetric || missingDiskMetrics;
  const metricsErrorMessage = buildMetricsErrorMessage(metricsQuery.failure);
  const liveRefreshPending = containersQuery.isFetching || metricsQuery.isFetching;

  const containers: unknown[] = Array.isArray(containersQuery.data) ? containersQuery.data : [];
  const runningCount = containers.filter(isRunningContainer).length;
  const agentUpdateStatus = getWatchtowerAgentUpdateStatus({
    installedVersion: selectedHost?.agent_version ?? null,
    capabilityGap: selectedHostReadable ? missingExtendedMetrics || !!metricsQuery.failure : false,
  });
  const agentUpdateStatusCopy = resolveAgentUpdateCopy(agentUpdateStatus);
  const verificationReason = agentVerificationReason(metricsQuery.failure, missingExtendedMetrics);
  const showAgentUpdateCta = !!selectedHost && agentUpdateStatus !== "current";

  const handleSelectHost = (hostId: string) => {
    if (isHostLocked(hostId)) {
      setUpgradeDialogOpen(true);
      return;
    }
    navigate(`/app/hosts/${hostId}`);
  };

  const handleRefreshLiveData = async () => {
    await Promise.allSettled([containersQuery.refetch(), metricsQuery.refetch()]);
    await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  };

  const handleTest = async () => {
    if (!selectedHost) return;
    setTesting(true);
    try {
      const result = await dockerApi.ping(selectedHost.id);
      toast({
        title: result.ok ? "Connection successful" : "Connection failed",
        description: buildPingToastDescription(result),
      });
      await refetch();
    } catch (error) {
      const sanitized = sanitizeConnectionError(error);
      toast({ title: sanitized.title, description: sanitized.description, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedHost) return;
    if (!confirm(`Remove host "${selectedHost.name}"? This only removes it from the dashboard.`)) return;
    try {
      await deleteHost.mutateAsync(selectedHost.id);
      toast({ title: "Host removed" });
      const refreshed = await refetch();
      const remainingHosts = Array.isArray(refreshed.data) ? refreshed.data : [];
      const fallbackHost = remainingHosts.find((host) => host.id !== selectedHost.id) ?? remainingHosts[0] ?? null;
      navigate(fallbackHost ? `/app/hosts/${fallbackHost.id}` : "/app/hosts", { replace: true });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
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
        <div className="glass-card p-12 text-center">
          <Terminal className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Docker hosts connected</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Connect a Docker host via a lightweight agent or Cloudflare Tunnel. No open Docker ports needed.
          </p>
          {currentOrg && <AddHostDialog orgId={currentOrg.id} trigger={<Button>Connect Your First Host</Button>} />}
        </div>
      ) : (
        <div className={cn("grid gap-6", isInfrastructureVisible ? "xl:grid-cols-[320px,minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)]")}>
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
              selectedHostAutoProbe={selectedHostAutoProbe}
              selectedHostDisconnected={selectedHostDisconnected}
              selectedHostStale={selectedHostStale}
              selectedHostReadable={selectedHostReadable}
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
            <div className="glass-card p-10 text-center text-muted-foreground">Select a host to view its details.</div>
          )}
        </div>
      )}

      <HostUpgradeDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen} nodeLimit={nodeLimit} />
    </div>
  );
}
