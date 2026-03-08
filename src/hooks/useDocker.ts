import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dockerApi } from "@/services/docker-api";
import { useAuth } from "@/contexts/AuthContext";
import type { DockerHost } from "@/types/database";

export function useDockerHosts(orgId?: string | null) {
  return useQuery({
    queryKey: ['docker-hosts', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('docker_hosts')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DockerHost[];
    },
    enabled: !!orgId,
  });
}

export function useAddDockerHost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ orgId, name, hostUrl, tlsCerts }: {
      orgId: string; name: string; hostUrl: string;
      tlsCerts?: { caCert: string; clientCert: string; clientKey: string; serverName?: string };
    }) => {
      const tlsEnabled = hostUrl.startsWith('https');

      // 1. Insert host record
      const { data, error } = await (supabase as any)
        .from('docker_hosts')
        .insert({
          organization_id: orgId,
          name,
          host_url: hostUrl,
          tls_enabled: tlsEnabled,
          created_by: user!.id,
          status: 'unknown',
        })
        .select()
        .single();
      if (error) throw error;

      // 2. If TLS certs provided, store them in the separate secure table
      if (tlsCerts) {
        const { error: tlsError } = await (supabase as any)
          .from('docker_host_tls')
          .insert({
            host_id: data.id,
            ca_cert: tlsCerts.caCert,
            client_cert: tlsCerts.clientCert,
            client_key: tlsCerts.clientKey,
            server_name: tlsCerts.serverName || null,
          });
        if (tlsError) {
          // Clean up the host if cert storage failed
          await (supabase as any).from('docker_hosts').delete().eq('id', data.id);
          throw new Error(`Failed to store TLS certificates: ${tlsError.message}`);
        }
      }

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
      // TLS certs cascade-delete via FK
      const { error } = await (supabase as any)
        .from('docker_hosts')
        .delete()
        .eq('id', hostId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-hosts'] });
    },
  });
}

export function useContainers(orgId?: string | null) {
  return useQuery({
    queryKey: ['containers', orgId],
    queryFn: () => dockerApi.allContainers(orgId!),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useHostContainers(hostId?: string | null) {
  return useQuery({
    queryKey: ['host-containers', hostId],
    queryFn: () => dockerApi.listContainers(hostId!),
    enabled: !!hostId,
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

export function useContainerLogs(hostId?: string | null, containerId?: string | null, tail = 200) {
  return useQuery({
    queryKey: ['container-logs', hostId, containerId, tail],
    queryFn: () => dockerApi.containerLogs(hostId!, containerId!, tail),
    enabled: !!hostId && !!containerId,
  });
}
