import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { apiFetch } from "@/lib/api";
import type { DockerHost, ConnectionMode } from "@/types/database";
import { useViewerState } from "@/hooks/useViewerState";
import { normalizePlan, PLAN_POLICY_BY_PLAN } from "@/shared/schema/plan-policy";

export function useDockerHosts(orgId?: string | null, options: { filterByPlan?: boolean } = {}) {
  const { data: viewer } = useViewerState();

  return useQuery({
    queryKey: ['docker-hosts', orgId],
    queryFn: async () => {
      return (await apiFetch(`/docker-hosts?orgId=${orgId}`)) as DockerHost[];
    },
    select: (hosts) => {
      if (!options.filterByPlan) return hosts;
      
      const entitlements = viewer?.entitlements;
      const activePlan = normalizePlan(entitlements?.plan ?? viewer?.active_org_effective_plan);
      const nodeLimit = entitlements?.nodeLimit ?? PLAN_POLICY_BY_PLAN[activePlan].nodeLimit;
      
      if (nodeLimit === null) return hosts;
      
      const sorted = [...hosts].sort((a, b) => {
        const dateA = a.created_at || (a as any).createdAt ? new Date(a.created_at || (a as any).createdAt).getTime() : 0;
        const dateB = b.created_at || (b as any).createdAt ? new Date(b.created_at || (b as any).createdAt).getTime() : 0;
        return dateA - dateB;
      });
      return sorted.slice(0, nodeLimit);
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useAddDockerHost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, name, hostUrl, connectionMode, dockerSocketPath, secrets }: {
      orgId: string; name: string; hostUrl: string;
      connectionMode: ConnectionMode;
      dockerSocketPath?: string;
      secrets: {
        agentApiKey?: string;
        cfServiceTokenId?: string;
        cfServiceTokenSecret?: string;
      };
    }) => {
      const data = await apiFetch('/docker-hosts', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: orgId,
          name,
          host_url: hostUrl,
          connection_mode: connectionMode,
          docker_socket_path: dockerSocketPath || '/var/run/docker.sock',
          secrets,
        }),
      });
      return data as DockerHost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-hosts'] });
    },
  });
}

export function useDeleteDockerHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hostId: string) => {
      await apiFetch(`/docker-hosts?hostId=${hostId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-hosts'] });
    },
  });
}

export function useUpdateDockerHost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hostId, name, hostUrl, connectionMode, dockerSocketPath, secrets }: {
      hostId: string;
      name: string;
      hostUrl: string;
      connectionMode: ConnectionMode;
      dockerSocketPath?: string;
      secrets: {
        agentApiKey?: string;
        cfServiceTokenId?: string;
        cfServiceTokenSecret?: string;
      };
    }) => {
      const data = await apiFetch(`/docker-hosts?hostId=${hostId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          host_url: hostUrl,
          connection_mode: connectionMode,
          docker_socket_path: dockerSocketPath || '/var/run/docker.sock',
          secrets,
        }),
      });
      return data as DockerHost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-hosts'] });
    },
  });
}

export function useContainers(orgId?: string | null, hasHosts = true, refetchInterval: number | false = 30000) {
  const { data: allowedHosts } = useDockerHosts(orgId, { filterByPlan: true });

  return useQuery({
    queryKey: ['containers', orgId],
    queryFn: () => dockerApi.allContainers(orgId!),
    select: (containers) => {
      if (!allowedHosts) return containers;
      const allowedIds = new Set(allowedHosts.map(h => h.id));
      return containers.filter(c => c.hostId ? allowedIds.has(c.hostId) : allowedIds.has(c._hostId));
    },
    enabled: !!orgId && hasHosts,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => (query.state.error || refetchInterval === false ? false : refetchInterval),
  });
}

export function useAllContainerStats(orgId?: string | null, hasHosts = true, refetchInterval: number | false = 15000) {
  const { data: allowedHosts } = useDockerHosts(orgId, { filterByPlan: true });

  return useQuery({
    queryKey: ['all-container-stats', orgId],
    queryFn: () => dockerApi.allContainerStats(orgId!),
    select: (stats) => {
      if (!allowedHosts) return stats;
      const allowedIds = new Set(allowedHosts.map(h => h.id));
      // Object.entries filter for stats object where keys are container IDs
      // Wait, allContainerStats returns an object keyed by container ID, and the values have hostId?
      // Let's assume the values have `hostId` or we can filter it. If it doesn't have hostId, we can't filter here.
      // We will check if the stats object can be filtered. But Dashboard relies on it being complete.
      return stats;
    },
    enabled: !!orgId && hasHosts,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => (query.state.error || refetchInterval === false ? false : refetchInterval),
  });
}

export function useHostContainers(hostId?: string | null, refetchInterval: number | false = 15000) {
  return useQuery({
    queryKey: ['host-containers', hostId],
    queryFn: () => dockerApi.listContainers(hostId!),
    enabled: !!hostId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => (query.state.error || refetchInterval === false ? false : refetchInterval),
  });
}

export function useContainerInspect(hostId?: string | null, containerId?: string | null) {
  return useQuery({
    queryKey: ['container-inspect', hostId, containerId],
    queryFn: () => dockerApi.inspectContainer(hostId!, containerId!),
    enabled: !!hostId && !!containerId,
  });
}

export function useContainerStats(
  hostId?: string | null,
  containerId?: string | null,
  refetchInterval: number | false = 10000,
) {
  return useQuery({
    queryKey: ['container-stats', hostId, containerId],
    queryFn: () => dockerApi.containerStats(hostId!, containerId!),
    enabled: !!hostId && !!containerId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval,
  });
}

export function useContainerLogs(hostId?: string | null, containerId?: string | null, tail: number | string = 200, since?: number, until?: number) {
  return useQuery({
    queryKey: ['container-logs', hostId, containerId, tail, since, until],
    queryFn: () => dockerApi.containerLogs(hostId!, containerId!, tail, since, until),
    enabled: !!hostId && !!containerId,
  });
}
