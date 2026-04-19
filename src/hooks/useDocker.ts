import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { apiFetch } from "@/lib/api";
import type { DockerHost, ConnectionMode } from "@/types/database";

export function useDockerHosts(orgId?: string | null) {
  return useQuery({
    queryKey: ['docker-hosts', orgId],
    queryFn: async () => {
      return (await apiFetch(`/docker-hosts?orgId=${orgId}`)) as DockerHost[];
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

export function useContainers(orgId?: string | null, hasHosts = true) {
  return useQuery({
    queryKey: ['containers', orgId],
    queryFn: () => dockerApi.allContainers(orgId!),
    enabled: !!orgId && hasHosts,
    refetchInterval: 30000,
  });
}

export function useAllContainerStats(orgId?: string | null, hasHosts = true) {
  return useQuery({
    queryKey: ['all-container-stats', orgId],
    queryFn: () => dockerApi.allContainerStats(orgId!),
    enabled: !!orgId && hasHosts,
    refetchInterval: 15000,
  });
}

export function useHostContainers(hostId?: string | null) {
  return useQuery({
    queryKey: ['host-containers', hostId],
    queryFn: () => dockerApi.listContainers(hostId!),
    enabled: !!hostId,
    retry: false,
    refetchInterval: 15000,
  });
}

export function useContainerInspect(hostId?: string | null, containerId?: string | null) {
  return useQuery({
    queryKey: ['container-inspect', hostId, containerId],
    queryFn: () => dockerApi.inspectContainer(hostId!, containerId!),
    enabled: !!hostId && !!containerId,
  });
}

export function useContainerStats(hostId?: string | null, containerId?: string | null) {
  return useQuery({
    queryKey: ['container-stats', hostId, containerId],
    queryFn: () => dockerApi.containerStats(hostId!, containerId!),
    enabled: !!hostId && !!containerId,
    refetchInterval: 10000,
  });
}

export function useContainerLogs(hostId?: string | null, containerId?: string | null, tail: number | string = 200, since?: number, until?: number) {
  return useQuery({
    queryKey: ['container-logs', hostId, containerId, tail, since, until],
    queryFn: () => dockerApi.containerLogs(hostId!, containerId!, tail, since, until),
    enabled: !!hostId && !!containerId,
  });
}
