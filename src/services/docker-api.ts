import { apiFetch } from "@/lib/api";

export interface DockerHostPingResult {
  ok: boolean;
  status: string;
  docker_version: string | null;
  agent_version: string | null;
  agent_version_error: string | null;
  agent_update_available: boolean;
  current_agent_version: string | null;
  latest_agent_version: string | null;
  upgrade_command: string | null;
  source_label: string | null;
  published_release: boolean;
  release_url: string | null;
  release_notes_url: string | null;
  checksum: string | null;
  os_info: string | null;
  connection_mode: string;
}

async function invoke(body: Record<string, unknown>, idempotencyKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const data = await apiFetch('/docker-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (data?.error) throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
  return data;
}

const genKey = () => crypto.randomUUID();

export const dockerApi = {
  ping: (hostId: string) => invoke({ action: 'ping', hostId }) as Promise<DockerHostPingResult>,
  hostMetrics: (hostId: string) => invoke({ action: 'host-metrics', hostId }),
  info: (hostId: string) => invoke({ action: 'info', hostId }),
  version: (hostId: string) => invoke({ action: 'version', hostId }),
  listContainers: (hostId: string) => invoke({ action: 'containers', hostId }),
  inspectContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-inspect', hostId, containerId }),
  containerStats: (hostId: string, containerId: string) =>
    invoke({ action: 'container-stats', hostId, containerId }),
  containerLogs: (hostId: string, containerId: string, tail: string | number = 100, since?: number, until?: number) =>
    invoke({ action: 'container-logs', hostId, containerId, params: { tail, since, until } }),
  startContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-start', hostId, containerId }, genKey()),
  stopContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-stop', hostId, containerId }, genKey()),
  restartContainer: (hostId: string, containerId: string) =>
    invoke({ action: 'container-restart', hostId, containerId }, genKey()),
  allContainers: (orgId: string) => invoke({ action: 'all-containers', orgId }),
  allContainerStats: (orgId: string) => invoke({ action: 'all-container-stats', orgId }),
  listFiles: (hostId: string, containerId: string, path: string) =>
    invoke({ action: 'container-fs-list', hostId, containerId, params: { path } }) as Promise<{ entries: FileEntry[] }>,
  readFile: (hostId: string, containerId: string, path: string) =>
    invoke({ action: 'container-fs-read', hostId, containerId, params: { path } }) as Promise<{ content: string; size: number; truncated: boolean }>,
};

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  permissions: string;
  modified: string;
  linkTarget?: string;
}
