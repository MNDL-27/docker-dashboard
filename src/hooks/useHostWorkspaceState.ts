import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrganization } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useDockerHosts, useDeleteDockerHost, useHostContainers } from "@/hooks/useDocker";
import { useHostMetricsHistory } from "@/hooks/useHostMetrics";
import { useViewerState } from "@/hooks/useViewerState";
import { useToast } from "@/hooks/use-toast";
import { dockerApi } from "@/services/docker-api";
import { CURRENT_WATCHTOWER_AGENT_VERSION } from "@/lib/agent-version";
import { sanitizeConnectionError } from "@/lib/error-sanitizer";
import {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  getWatchtowerAgentUpdateStatus,
  getWatchtowerAgentUpdateStatusCopy,
} from "@/lib/agent-release";
import { normalizeHostStatus, isReadableHostStatus } from "@/lib/host-health-state";
import { resolveNodeLimit, getAllowedHostIds, sortHostsByCreation, isHostLocked as checkIsHostLocked } from "@/lib/host-limits";
import type { DockerHost } from "@/types/database";

export function useHostWorkspaceState() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: routeHostId } = useParams();
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const deleteHost = useDeleteDockerHost();
  const { data: hosts = [], isLoading, refetch } = useDockerHosts(currentOrg?.id, { filterByPlan: false });
  
  const [search, setSearch] = useState("");
  const [testing, setTesting] = useState(false);
  const [isInfrastructureVisible, setIsInfrastructureVisible] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const nodeLimit = resolveNodeLimit(viewer);

  const hostsSortedByCreation = useMemo(() => {
    return sortHostsByCreation(hosts);
  }, [hosts]);

  const allowedHostIds = useMemo(() => {
    return getAllowedHostIds(hosts, nodeLimit);
  }, [hosts, nodeLimit]);

  const isHostLocked = useCallback((hostId: string) => {
    return checkIsHostLocked(hostId, allowedHostIds);
  }, [allowedHostIds]);

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
    if (allowedHostIds !== null) {
      const firstAllowed = filteredHosts.find(h => allowedHostIds.has(h.id))
        ?? hosts.find(h => allowedHostIds.has(h.id));
      return firstAllowed ?? null;
    }
    return filteredHosts[0] ?? hosts[0] ?? null;
  }, [allowedHostIds, filteredHosts, hosts, routeHostId]);

  useEffect(() => {
    if (isLoading || !routeHostId) return;

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

  const selectedHostAutoProbe = selectedHost ? ["connected", "stale"].includes(normalizeHostStatus(selectedHost.status)) : false;
  const selectedHostLocked = selectedHost ? isHostLocked(selectedHost.id) : false;
  
  const containersQuery = useHostContainers(selectedHostAutoProbe && !selectedHostLocked ? selectedHost?.id : null, 15000);
  const metricsQuery = useHostMetricsHistory(selectedHostAutoProbe && !selectedHostLocked ? selectedHost?.id : null, {
    enabled: selectedHostAutoProbe && !selectedHostLocked,
    refetchInterval: 10000,
    maxDataPoints: 24,
  });

  const containers = Array.isArray(containersQuery.data) ? containersQuery.data : [];
  const runningCount = containers.filter((container: any) => container.State === "running").length;
  
  const missingUptimeMetric = !!metricsQuery.latestPoint && metricsQuery.latestPoint.uptimeSeconds === null;
  const missingDiskMetrics = !!metricsQuery.latestPoint && metricsQuery.latestPoint.disks.length === 0;
  const missingExtendedMetrics = missingUptimeMetric || missingDiskMetrics;

  const agentUpdateStatus = getWatchtowerAgentUpdateStatus({
    installedVersion: selectedHost?.agent_version ?? null,
    capabilityGap: selectedHost ? isReadableHostStatus(selectedHost.status) && missingExtendedMetrics : false,
  });
  
  const agentUpdateStatusCopy = getWatchtowerAgentUpdateStatusCopy(agentUpdateStatus, CURRENT_WATCHTOWER_AGENT_RELEASE)
    ?? getWatchtowerAgentUpdateStatusCopy("pending", CURRENT_WATCHTOWER_AGENT_RELEASE);

  const handleSelectHost = (hostId: string) => {
    if (isHostLocked(hostId)) {
      setUpgradeDialogOpen(true);
      return;
    }
    navigate(`/app/hosts/${hostId}`);
  };

  const handleTest = async () => {
    if (!selectedHost) return;
    setTesting(true);
    try {
      const result = await dockerApi.ping(selectedHost.id);
      toast({
        title: result.ok ? "Connection successful" : "Connection failed",
        description: result.ok ? `Docker ${result.docker_version || "detected"}.` : undefined,
      });
      await refetch();
    } catch (error: any) {
      const sanitized = sanitizeConnectionError(error);
      toast({ title: sanitized.title, description: sanitized.description, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedHost) return;
    if (!confirm(`Remove host "${selectedHost.name}"?`)) return;
    try {
      await deleteHost.mutateAsync(selectedHost.id);
      toast({ title: "Host removed" });
      const refreshed = await refetch();
      const remainingHosts = Array.isArray(refreshed.data) ? refreshed.data : [];
      const fallbackHost = remainingHosts.find((host) => host.id !== selectedHost.id) ?? remainingHosts[0] ?? null;
      navigate(fallbackHost ? `/app/hosts/${fallbackHost.id}` : "/app/hosts", { replace: true });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  return {
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
  };
}
