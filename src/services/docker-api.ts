import { supabase } from "@/integrations/supabase/client";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('docker-proxy', { body });
  if (error) throw new Error(error.message || 'Docker proxy error');
  if (data?.error) throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
  return data;
}

export const dockerApi = {
  ping: (hostId: string) => invoke({ action: 'ping', hostId }),
  info: (hostId: string) => invoke({ action: 'info', hostId }),
  version: (hostId: string) => invoke({ action: 'version', hostId }),
  listContainers: (hostId: string) => invoke({ action: 'containers', hostId }),
  inspectContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-inspect', hostId, containerId }),
  containerStats: (hostId: string, containerId: string) =>
    invoke({ action: 'container-stats', hostId, containerId }),
  containerLogs: (hostId: string, containerId: string, tail = 100) =>
    invoke({ action: 'container-logs', hostId, containerId, params: { tail } }),
  startContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-start', hostId, containerId }),
  stopContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-stop', hostId, containerId }),
  restartContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-restart', hostId, containerId }),
  allContainers: (orgId: string) => invoke({ action: 'all-containers', orgId }),
};
