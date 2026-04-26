import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { apiFetch } from "@/lib/api";
import type { DockerHost, ConnectionMode } from "@/types/database";
import { useViewerState } from "@/hooks/useViewerState";
import { normalizePlan, PLAN_POLICY_BY_PLAN } from "../../shared/schema/plan-policy";

// ── Shared types & helpers ──────────────────────────────────────────

/** Shared secrets shape for host mutations */
interface HostSecrets {
  agentApiKey?: string;
  cfServiceTokenId?: string;
  cfServiceTokenSecret?: string;
}

/** Shared fields for host create/update (WR-02) */
interface HostMutationBase {
  name: string;
  hostUrl: string;
  connectionMode: ConnectionMode;
  dockerSocketPath?: string;
  secrets: HostSecrets;
}

/** Build the API body from host mutation fields */
function buildHostBody(fields: HostMutationBase) {
  return {
    name: fields.name,
    host_url: fields.hostUrl,
    connection_mode: fields.connectionMode,
    docker_socket_path: fields.dockerSocketPath || '/var/run/docker.sock',
    secrets: fields.secrets,
  };
}

/** Resolve effective node limit from viewer entitlements + plan policy (WR-01) */
function resolveNodeLimit(viewer: any): number | null {
  const entitlements = viewer?.entitlements;
  // When entitlements are loaded, use nodeLimit directly — null means unlimited
  // (enterprise/dedicated plans). Only fall back to plan policy when entitlements
  // haven't loaded yet (viewer is undefined/null).
  if (entitlements) {
    return entitlements.nodeLimit; // null = unlimited, number = capped
  }
  const activePlan = normalizePlan(viewer?.active_org_effective_plan);
  return PLAN_POLICY_BY_PLAN[activePlan].nodeLimit;
}

/** Sort hosts by creation date (oldest first), breaking ties by ID (WR-01) */
function sortHostsByCreation(hosts: DockerHost[]): DockerHost[] {
  return [...hosts].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime() || 0;
    const dateB = new Date(b.created_at).getTime() || 0;
    return dateA - dateB || a.id.localeCompare(b.id);
  });
}

/** Log query options parameter object (WR-03) */
interface ContainerLogOptions {
  tail?: number | string;
  since?: number;
  until?: number;
}

// ── Hooks ───────────────────────────────────────────────────────────

export function useDockerHosts(orgId?: string | null, options: { filterByPlan?: boolean } = {}) {
  const { data: viewer } = useViewerState();

  return useQuery({
    queryKey: ['docker-hosts', orgId],
    queryFn: async () => {
      return (await apiFetch(`/docker-hosts?orgId=${orgId}`)) as DockerHost[];
    },
    select: (hosts) => {
      if (!options.filterByPlan) return hosts;
      const nodeLimit = resolveNodeLimit(viewer);
      if (nodeLimit === null) return hosts;
      return sortHostsByCreation(hosts).slice(0, nodeLimit);
    },
    enabled: !!orgId,
    refetchInterval: (query) => (query.state.error ? false : 15000),
  });
}

export function useAddDockerHost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, ...fields }: { orgId: string } & HostMutationBase) => {
      const data = await apiFetch('/docker-hosts', {
        method: 'POST',
        body: JSON.stringify({ organization_id: orgId, ...buildHostBody(fields) }),
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
    mutationFn: async ({ hostId, ...fields }: { hostId: string } & HostMutationBase) => {
      const data = await apiFetch(`/docker-hosts?hostId=${hostId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildHostBody(fields)),
      });
      return data as DockerHost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-hosts'] });
    },
  });
}

export function useContainers(orgId?: string | null, hasHosts = true, refetchInterval: number | false = 30000) {
  const queryClient = useQueryClient();
  const { data: allowedHosts } = useDockerHosts(orgId, { filterByPlan: true });

  return useQuery({
    queryKey: ['containers', orgId],
    queryFn: async () => {
      const containers = await dockerApi.allContainers(orgId!);

      // Container fetch succeeded — the agent responded, so the host is alive.
      // Optimistically update host status in cache to eliminate the stale-status
      // gap between this fetch and the next hosts refetch cycle.
      queryClient.setQueryData<DockerHost[]>(['docker-hosts', orgId], (prev) => {
        if (!prev) return prev;
        const respondingHostIds = new Set<string>(
          containers
            .map((c: any) => c._hostId || c.hostId)
            .filter(Boolean),
        );
        if (respondingHostIds.size === 0) return prev;
        let changed = false;
        const updated = prev.map((host) => {
          if (respondingHostIds.has(host.id) && host.status !== 'connected') {
            changed = true;
            return { ...host, status: 'connected', last_seen_at: new Date().toISOString() };
          }
          return host;
        });
        return changed ? updated : prev;
      });

      return containers;
    },
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
  return useQuery({
    queryKey: ['all-container-stats', orgId],
    queryFn: () => dockerApi.allContainerStats(orgId!),
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

export function useContainerLogs(
  hostId?: string | null,
  containerId?: string | null,
  options: ContainerLogOptions = {},
) {
  const { tail = 200, since, until } = options;
  return useQuery({
    queryKey: ['container-logs', hostId, containerId, tail, since, until],
    queryFn: () => dockerApi.containerLogs(hostId!, containerId!, tail, since, until),
    enabled: !!hostId && !!containerId,
  });
}
