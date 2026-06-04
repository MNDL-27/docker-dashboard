import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { assertHostProxyAllowed, assertOrganizationWriteAllowed, enforceOrganizationNodeLimit, resolveOrganizationEntitlements } from './lib/access-controls.mjs';
import { decryptHostSecrets, SecretCryptoError } from './lib/crypto.mjs';
import { buildWatchtowerAgentReleaseResponse } from './lib/agent-release.mts';
import { ensureDockerHostSchema } from './lib/ensure-docker-host-schema.mjs';
import { buildValidatedAgentUrl } from './lib/host-url.mjs';
import { createProblemResponse as createBaseProblemResponse } from '../../shared/schema/error.ts';
import { ProxyRequestParamsSchema } from '../../shared/schema/proxy.ts';
import { formatDiagnosticDetail, parseDiagnosticPayload } from '../../shared/lib/diagnostics.ts';
import { buildCorsHeaders, applyRateLimit, RATE_LIMITS, logSecurityEvent, getClientIp } from './lib/security.mjs';
import { parseTarDirectory } from './lib/tar-directory-parser.mjs';

function sanitizeContainerId(id: string): string {
  const normalized = id.trim();

  if (!/^[a-f0-9]{12,64}$/i.test(normalized)) {
    throw new Error('Invalid container ID format');
  }

  return normalized;
}

function buildRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  dockerPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const reqHeaders: Record<string, string> = {};

  const url = buildValidatedAgentUrl(base, `/docker${dockerPath}`);

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key;
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path;
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url, method, headers: reqHeaders };
}


function buildAgentRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  agentPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const reqHeaders: Record<string, string> = {};

  const url = buildValidatedAgentUrl(base, agentPath);

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key;
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path;
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url, method, headers: reqHeaders };
}

function trimDiagnostic(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function extractDiagnosticMessage(details: unknown): string | null {
  if (!details) {
    return null;
  }

  if (typeof details === 'string') {
    const normalized = details.trim();
    return normalized ? trimDiagnostic(normalized) : null;
  }

  if (typeof details === 'object') {
    const detailRecord = details as Record<string, unknown>;
    const candidates = [
      detailRecord.detail,
      detailRecord.error,
      detailRecord.title,
      detailRecord.message,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return trimDiagnostic(candidate.trim());
      }
    }

    try {
      return trimDiagnostic(JSON.stringify(details));
    } catch {
      return null;
    }
  }

  return trimDiagnostic(String(details));
}

function getDiagnosticField(details: unknown, field: string) {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const value = (details as Record<string, unknown>)[field];
  return typeof value === 'string' ? value.trim() : null;
}

function stringifyDiagnostic(details: unknown) {
  if (typeof details === 'string') {
    return details;
  }

  if (details && typeof details === 'object') {
    try {
      return JSON.stringify(details);
    } catch {
      return '';
    }
  }

  return details === null || details === undefined ? '' : String(details);
}

function isAgentDockerSocketFailure(details: unknown) {
  const error = getDiagnosticField(details, 'error') ?? '';
  const code = getDiagnosticField(details, 'code') ?? '';
  const diagnostic = extractDiagnosticMessage(details) ?? '';
  const haystack = `${code} ${error} ${diagnostic} ${stringifyDiagnostic(details)}`;

  return /docker_socket_unavailable/i.test(haystack) ||
    /docker socket not found/i.test(haystack) ||
    /docker api request failed/i.test(haystack);
}

function summarizeDockerSocketFailure(details: unknown) {
  const diagnostic = extractDiagnosticMessage(details);

  if (diagnostic && /docker socket not found/i.test(diagnostic)) {
    return `${diagnostic}. Confirm Docker is running and that the saved Docker socket path matches the host.`;
  }

  return diagnostic
    ? `The Watchtower agent is reachable, but it could not talk to Docker through its configured socket (${diagnostic}). Re-run Troubleshoot / Repair so the systemd service gets Docker socket group access.`
    : 'The Watchtower agent is reachable, but it could not talk to Docker through its configured socket. Re-run Troubleshoot / Repair so the systemd service gets Docker socket group access.';
}

function summarizeAgentConnectionFailure(
  status: number,
  rawDetails: string,
  connectionMode: string,
) {
  const parsedDetails = parseDiagnosticPayload(rawDetails);
  const diagnostic = extractDiagnosticMessage(parsedDetails);
  const isCloudflareHtml =
    typeof diagnostic === 'string' && /Cloudflare HTML error page:/i.test(diagnostic);

  if (isAgentApiKeyFailure(status, rawDetails)) {
    return 'The Watchtower agent is reachable, but it rejected the saved API key. Re-enter the API key from /etc/watchtower-agent/watchtower-agent.env or run the agent repair command so Dockerdash and the agent use the same key.';
  }

  if (isAgentDockerSocketFailure(parsedDetails)) {
    return summarizeDockerSocketFailure(parsedDetails);
  }

  if (status === 504) {
    return 'The Watchtower agent did not respond in time. Verify the agent service is running and reachable from Dockerdash.';
  }

  if ((status === 502 || status === 530) && isCloudflareHtml) {
    if (connectionMode === 'cloudflare_tunnel') {
      return 'Cloudflare Tunnel could not reach your Watchtower agent. Verify the tunnel is running, the route points to the agent, and any CF Access service token is correct.';
    }

    return 'A Cloudflare gateway in front of your Watchtower agent returned an error. Verify the saved host URL, reverse proxy, and agent service.';
  }

  if (isCloudflareHtml) {
    if (connectionMode === 'cloudflare_tunnel') {
      return `Cloudflare returned HTTP ${status}. The tunnel may be misconfigured or the agent service is unreachable. Check the tunnel health and agent process.`;
    }
    return `Cloudflare returned HTTP ${status}. Verify the saved host URL, reverse proxy, and agent service.`;
  }

  if (status === 502) {
    return diagnostic
      ? `Dockerdash could not reach the Watchtower agent: ${diagnostic}`
      : 'Dockerdash could not reach the Watchtower agent. Verify the saved host URL and that the agent service is running.';
  }

  if (diagnostic) {
    return `The Watchtower agent returned HTTP ${status}: ${diagnostic}`;
  }

  return `The Watchtower agent returned HTTP ${status}.`;
}

function isAgentApiKeyFailure(status: number, rawDetails: string) {
  const diagnostic = extractDiagnosticMessage(parseDiagnosticPayload(rawDetails)) ?? '';
  const lower = diagnostic.toLowerCase();

  return lower.includes('invalid api key') ||
    lower.includes('invalid agent api key') ||
    (lower.includes('api key') && lower.includes('invalid'));
}

function createAgentUnauthorizedResponse(
  upstreamStatus: number,
  detail: string,
  corsHeaders: Record<string, string>,
) {
  return new Response(
    JSON.stringify({
      type: 'agent_unauthorized',
      title: 'Agent authentication failed',
      status: 502,
      detail,
      code: 'agent_auth_failed',
      upstream_status: upstreamStatus,
    }),
    {
      status: 502,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/problem+json',
      },
    },
  );
}

function classifyTopLevelProxyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("sync pending")) {
    return { status: 202, title: "Sync pending", detail: message, type: "sync_pending" };
  }

  if (lower.includes("forbidden") || lower.includes("awaiting platform approval") || lower.includes("disabled by a platform administrator")) {
    return { status: 403, title: "Forbidden", detail: message, type: "forbidden" };
  }

  if (lower.includes("unauthorized")) {
    return { status: 401, title: "Unauthorized", detail: message, type: "unauthorized" };
  }

  if (lower.includes("no active organization selected")) {
    return { status: 409, title: "No active organization selected", detail: message, type: "missing_organization" };
  }

  return { status: 502, title: "Docker connection failed", detail: message, type: "docker_connection_failed" };
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeOptionalRate(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) {
    return null;
  }

  return numeric;
}

function normalizeDiskMetric(value: any) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const device = typeof value.device === 'string' ? value.device.trim() : '';
  const mount = typeof value.mount === 'string' ? value.mount.trim() : '';
  const usedBytes = toFiniteNumber(value.used_bytes ?? value.usedBytes);
  const totalBytes = toFiniteNumber(value.total_bytes ?? value.totalBytes);
  const readBytesPerSec = normalizeOptionalRate(value.read_bytes_per_sec ?? value.readBytesPerSec);
  const writeBytesPerSec = normalizeOptionalRate(value.write_bytes_per_sec ?? value.writeBytesPerSec);

  if (!device || !mount || usedBytes === null || totalBytes === null || usedBytes < 0 || totalBytes <= 0 || usedBytes > totalBytes) {
    return null;
  }

  return {
    device,
    mount,
    usedBytes,
    totalBytes,
    readBytesPerSec,
    writeBytesPerSec,
  };
}

function classifyHostMetricsFailure(status: number, details: unknown) {
  if (isAgentDockerSocketFailure(details)) {
    return {
      error: 'Docker socket unavailable',
      code: 'docker_socket_unavailable',
      details,
      upstream_status: status,
    };
  }

  if (status === 404 || status === 405) {
    return {
      error: 'Host metrics endpoint unsupported',
      code: 'metrics_endpoint_unsupported',
      details,
      upstream_status: status,
    };
  }

  if (status === 504) {
    return {
      error: 'Host metrics request timed out',
      code: 'agent_timeout',
      details,
      upstream_status: status,
    };
  }

  if (status === 502) {
    return {
      error: 'Host metrics connection failed',
      code: 'agent_connection_failed',
      details,
      upstream_status: status,
    };
  }

  return {
    error: 'Host metrics unavailable',
    code: 'host_metrics_unavailable',
    details,
    upstream_status: status,
  };
}

function classifyDockerProxyFailure(status: number, details: unknown) {
  if (isAgentDockerSocketFailure(details)) {
    return {
      error: 'Docker socket unavailable',
      code: 'docker_socket_unavailable',
      details,
      upstream_status: status,
    };
  }

  if (status === 404 || status === 405) {
    return {
      error: 'Docker API endpoint unsupported',
      code: 'docker_endpoint_unsupported',
      details,
      upstream_status: status,
    };
  }

  if (status === 504) {
    return {
      error: 'Docker API request timed out',
      code: 'agent_timeout',
      details,
      upstream_status: status,
    };
  }

  if (status === 502) {
    return {
      error: 'Docker API connection failed',
      code: 'agent_connection_failed',
      details,
      upstream_status: status,
    };
  }

  return {
    error: `Docker API error: ${status}`,
    code: 'docker_api_error',
    details,
    upstream_status: status,
  };
}

function createHostMetricsPoint(data: any) {
  const cpuTimeNs = Math.max(0, toFiniteNumber(data?.cpu_time_ns) ?? 0);
  const systemTimeNs = Math.max(0, toFiniteNumber(data?.system_time_ns) ?? 0);
  const totalCores = Math.max(0, toFiniteNumber(data?.online_cpus) ?? 0);
  const memoryUsed = Math.max(0, toFiniteNumber(data?.memory_used) ?? 0);
  const memoryLimit = Math.max(0, toFiniteNumber(data?.memory_limit) ?? 0);
  const uptimeSecondsRaw = toFiniteNumber(data?.uptime_seconds ?? data?.uptimeSeconds);
  const uptimeSeconds = uptimeSecondsRaw !== null && uptimeSecondsRaw >= 0 ? uptimeSecondsRaw : null;
  const disks = Array.isArray(data?.disks)
    ? data.disks.map((disk: any) => normalizeDiskMetric(disk)).filter(Boolean)
    : [];
  const timestamp = Date.now();

  if (totalCores === 0 && memoryLimit === 0 && cpuTimeNs === 0 && systemTimeNs === 0 && memoryUsed === 0) {
    return {
      timestamp,
      time: new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      cpu: 0,
      memory: 0,
      usedCores: 0,
      totalCores: 0,
      memoryUsed: 0,
      memoryLimit: 0,
      networkInBytesPerSec: normalizeOptionalRate(data?.network_in_bytes_per_sec ?? data?.networkInBytesPerSec),
      networkOutBytesPerSec: normalizeOptionalRate(data?.network_out_bytes_per_sec ?? data?.networkOutBytesPerSec),
      networkMonthlyTotal: toFiniteNumber(data?.network_monthly_total),
      diskReadBytesPerSec: normalizeOptionalRate(data?.disk_read_bytes_per_sec ?? data?.diskReadBytesPerSec),
      diskWriteBytesPerSec: normalizeOptionalRate(data?.disk_write_bytes_per_sec ?? data?.diskWriteBytesPerSec),
      uptimeSeconds,
      disks,
    };
  }

  if (systemTimeNs <= 0 || (totalCores === 0 && memoryLimit === 0)) {
    return null;
  }

  const usedCores = totalCores > 0 ? (cpuTimeNs / systemTimeNs) * totalCores : 0;
  const cpu = totalCores > 0 ? Math.max(0, Math.min(100, (usedCores / totalCores) * 100)) : 0;
  const memory = memoryLimit > 0 ? Math.max(0, Math.min(100, (memoryUsed / memoryLimit) * 100)) : 0;

  return {
    timestamp,
    time: new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    cpu: Math.round(cpu * 100) / 100,
    memory: Math.round(memory * 100) / 100,
    usedCores: Math.round(usedCores * 100) / 100,
    totalCores: Math.round(totalCores * 100) / 100,
    memoryUsed,
    memoryLimit,
    networkInBytesPerSec: normalizeOptionalRate(data?.network_in_bytes_per_sec ?? data?.networkInBytesPerSec),
    networkOutBytesPerSec: normalizeOptionalRate(data?.network_out_bytes_per_sec ?? data?.networkOutBytesPerSec),
    networkMonthlyTotal: toFiniteNumber(data?.network_monthly_total),
    diskReadBytesPerSec: normalizeOptionalRate(data?.disk_read_bytes_per_sec ?? data?.diskReadBytesPerSec),
    diskWriteBytesPerSec: normalizeOptionalRate(data?.disk_write_bytes_per_sec ?? data?.diskWriteBytesPerSec),
    uptimeSeconds,
    disks,
  };
}



async function fetchAgentVersionReport(
  host: { id: string; host_url: string; connection_mode: string; docker_socket_path: string },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
) {
  try {
    const req = buildAgentRequest(host, secrets, '/agent/version', 'GET');
    const resp = await dockerFetch(req.url, req.method, req.headers, 5000);

    if (!resp.ok) {
      const body = formatDiagnosticDetail(parseDiagnosticPayload(await resp.text()));
      return {
        agentVersion: null as string | null,
        agentVersionError: trimDiagnostic(
          body
            ? `GET /agent/version returned ${resp.status}: ${body}`
            : `GET /agent/version returned ${resp.status}`,
        ),
      };
    }

    const data = await resp.json();
    const agentVersion = data.agent_version || data.version || null;

    if (!agentVersion) {
      return {
        agentVersion: null as string | null,
        agentVersionError: 'GET /agent/version did not include an agent version',
      };
    }

    return { agentVersion, agentVersionError: null as string | null };
  } catch (err: any) {
    return {
      agentVersion: null as string | null,
      agentVersionError: trimDiagnostic(`GET /agent/version failed: ${err?.message || 'Unknown error'}`),
    };
  }
}

// Bounded concurrency helper for querying multiple hosts
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const exec = async () => {
    while (i < items.length) {
      const index = i++;
      results[index] = await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, exec);
  await Promise.all(workers);
  return results;
}

async function dockerFetch(url: string, method: string, reqHeaders: Record<string, string>, timeoutMs = 5000, maxPayloadSize = 4 * 1024 * 1024) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: reqHeaders,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return new Response(JSON.stringify({ error: 'Agent connection timed out' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Agent connection failed', details: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalSize += value.length;
        if (totalSize > maxPayloadSize) {
          reader.cancel('Payload too large');
          const limitMB = Math.round(maxPayloadSize / (1024 * 1024));
          return new Response(JSON.stringify({ error: `Payload too large (exceeds ${limitMB}MB limit)` }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        chunks.push(value);
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return new Response(JSON.stringify({ error: 'Agent stream timed out' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Stream read error', details: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  const fullBody = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    fullBody.set(chunk, offset);
    offset += chunk.length;
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.delete('content-encoding'); 
  return new Response(fullBody, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

export default async (req: Request) => {
  // Apply rate limiting for proxy endpoint
  const rateLimitResponse = await applyRateLimit(req, 'proxy', RATE_LIMITS.PROXY);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Build CORS headers with trusted origins only
  const corsHeaders = buildCorsHeaders(req);
  const createProblemResponse = (
    status: number,
    title: string,
    detail?: string,
    type?: string,
  ) => createBaseProblemResponse(status, title, detail, type, corsHeaders);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await ensureDockerHostSchema();

    const auth = await requireAuth(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return createProblemResponse(400, "Invalid JSON payload");
    }

    const parseResult = ProxyRequestParamsSchema.safeParse(body);
    if (!parseResult.success) {
      return createProblemResponse(400, "Validation Error", JSON.stringify(parseResult.error.format()));
    }
    const { action, hostId, containerId, params } = parseResult.data;

    const orgId = auth.orgId;

    // ── Org-wide: fetch containers from all hosts ──
    if (action === 'all-containers') {
      if (!orgId) return createProblemResponse(400, "orgId required");

      const memberships = await sql`
        SELECT 1 FROM organization_members WHERE organization_id = ${orgId} AND user_id = ${auth.userId}
      `;
      if (memberships.length === 0) return createProblemResponse(403, "Access denied");

      const limitState = await enforceOrganizationNodeLimit({
        organizationId: orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      if (limitState.allowedHostIds.length === 0) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }



      const hosts = await sql`
        SELECT h.*
        FROM docker_hosts h
        LEFT JOIN docker_host_admin_controls hac ON hac.host_id = h.id
        WHERE h.organization_id = ${orgId}
          AND h.id = ANY(${limitState.allowedHostIds})
          AND COALESCE(hac.is_quarantined, false) = false
      `;
      const allContainers: any[] = [];

      await mapConcurrent(hosts as any[], 5, async (host) => {
        try {
          const secretsRecord = await sql`
            SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
            FROM docker_host_secrets WHERE host_id = ${host.id}
          `;
          const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

          const { url, method, headers: reqHeaders } = buildRequest(host, secrets, '/containers/json?all=true', 'GET');
          const resp = await dockerFetch(url, method, reqHeaders, 5000); // 5s timeout
          
          if (resp.ok && resp.status !== 413) {
            const containers = await resp.json();
            allContainers.push(...containers.map((c: any) => ({ ...c, _hostId: host.id, _hostName: host.name })));
            await sql`UPDATE docker_hosts SET status = 'connected', last_seen_at = now(), consecutive_failures = 0, last_error = null WHERE id = ${host.id}`;
          } else {
            await sql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
          }
        } catch (_e) {
          await sql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
        }
      });

      return new Response(JSON.stringify(allContainers), {
        headers: corsHeaders,
      });
    }

    // ── Org-wide: fetch stats for all running containers ──
    if (action === 'all-container-stats') {
      if (!orgId) return createProblemResponse(400, "orgId required");

      const memberships = await sql`
        SELECT 1 FROM organization_members WHERE organization_id = ${orgId} AND user_id = ${auth.userId}
      `;
      if (memberships.length === 0) return createProblemResponse(403, "Access denied");

      const limitState = await enforceOrganizationNodeLimit({
        organizationId: orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      if (limitState.allowedHostIds.length === 0) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }



      const hosts = await sql`
        SELECT h.*
        FROM docker_hosts h
        LEFT JOIN docker_host_admin_controls hac ON hac.host_id = h.id
        WHERE h.organization_id = ${orgId}
          AND h.id = ANY(${limitState.allowedHostIds})
          AND h.status = 'connected'
          AND COALESCE(hac.is_quarantined, false) = false
      `;
      const allStats: any[] = [];

      await mapConcurrent(hosts as any[], 5, async (host) => {
        try {
          const secretsRecord = await sql`
            SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
            FROM docker_host_secrets WHERE host_id = ${host.id}
          `;
          const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

          // Get running containers only (no need for exited container stats)
          const listReq = buildRequest(host, secrets, '/containers/json', 'GET');
          const listResp = await dockerFetch(listReq.url, listReq.method, listReq.headers, 3000);
          if (!listResp.ok) return;
          const containers = await listResp.json();
          if (!Array.isArray(containers) || containers.length === 0) return;

          // Update heartbeat — agent responded successfully
          await sql`UPDATE docker_hosts SET status = 'connected', last_seen_at = now(), consecutive_failures = 0 WHERE id = ${host.id}`;

          // Cap at 20 containers per host to bound latency
          const capped = containers.slice(0, 20);

          await mapConcurrent(capped, 5, async (container: any) => {
            try {
              const cId = container.Id;
              const statsReq = buildRequest(host, secrets, `/containers/${cId}/stats?stream=false`, 'GET');
              const statsResp = await dockerFetch(statsReq.url, statsReq.method, statsReq.headers, 3000);
              if (!statsResp.ok) return;
              const s = await statsResp.json();

              // CPU % calculation (same as Docker CLI)
              const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage ?? 0) - (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
              const systemDelta = (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
              const onlineCpus = s.cpu_stats?.online_cpus || 1;
              const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

              // Memory
              const memUsage = s.memory_stats?.usage ?? 0;
              const memLimit = s.memory_stats?.limit ?? 0;

              // Network I/O (sum across all interfaces)
              let netRx = 0, netTx = 0;
              if (s.networks) {
                for (const iface of Object.values(s.networks) as any[]) {
                  netRx += iface.rx_bytes ?? 0;
                  netTx += iface.tx_bytes ?? 0;
                }
              }

              allStats.push({
                containerId: cId,
                hostId: host.id,
                cpu_percent: Math.round(cpuPercent * 100) / 100,
                memory_usage: memUsage,
                memory_limit: memLimit,
                net_rx: netRx,
                net_tx: netTx,
              });
            } catch (_) { /* skip container on error */ }
          });
        } catch (_) { /* skip host on error */ }
      });

      return new Response(JSON.stringify(allStats), {
        headers: corsHeaders,
      });
    }

    // ── Host-specific actions ──
    if (!hostId) return createProblemResponse(400, "hostId required");

    const hostRecords = await sql`
      SELECT h.* FROM docker_hosts h
      JOIN organization_members om ON h.organization_id = om.organization_id
      WHERE h.id = ${hostId} AND om.user_id = ${auth.userId}
    `;

    if (hostRecords.length === 0) {
      return createProblemResponse(404, "Host not found or access denied");
    }
    const host = hostRecords[0];

    const limitState = await enforceOrganizationNodeLimit({
      organizationId: host.organization_id,
      isPlatformAdmin: auth.isPlatformAdmin,
    });

    if (!limitState.allowedHostIds.includes(host.id)) {
      return createProblemResponse(
        402,
        "Host over plan limit",
        "This host is inactive because your current plan limit has been exceeded. Remove extra hosts or upgrade to reactivate it.",
        "host_plan_limit_exceeded",
      );
    }

    await assertHostProxyAllowed({ hostId, isPlatformAdmin: auth.isPlatformAdmin });

    const secretsRecord = await sql`
      SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
      FROM docker_host_secrets WHERE host_id = ${hostId}
    `;
    const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

    if (action === 'host-metrics') {


      const metricsReq = buildAgentRequest(host as any, secrets, '/metrics', 'GET');
      const metricsResponse = await dockerFetch(metricsReq.url, metricsReq.method, metricsReq.headers, 5000);

      if (!metricsResponse.ok) {
        const rawDetails = await metricsResponse.text();
        const parsedDetails = parseDiagnosticPayload(rawDetails);
        const failure = classifyHostMetricsFailure(metricsResponse.status || 502, parsedDetails);

        return new Response(JSON.stringify(failure), { status: metricsResponse.status || 502, headers: corsHeaders });
      }

      const metricsData = await metricsResponse.json();
      
      // Monthly network usage accumulation
      const currentRx = toFiniteNumber(metricsData.network_rx_total);
      const currentTx = toFiniteNumber(metricsData.network_tx_total);
      const monthBucket = new Date().toISOString().slice(0, 7); // UTC YYYY-MM
      
      let monthlyTotal = 0;

      if (currentRx !== null && currentTx !== null) {
        try {
          // Atomic upsert with delta accumulation and reset detection
          const usageResult = await sql`
            INSERT INTO host_network_usage (host_id, month_bucket, last_raw_rx, last_raw_tx, accumulated_rx, accumulated_tx)
            VALUES (${hostId}, ${monthBucket}, ${currentRx}, ${currentTx}, 0, 0)
            ON CONFLICT (host_id, month_bucket) DO UPDATE SET
              accumulated_rx = host_network_usage.accumulated_rx + CASE 
                WHEN ${currentRx} >= host_network_usage.last_raw_rx THEN (${currentRx} - host_network_usage.last_raw_rx)
                ELSE ${currentRx} -- Reset detection (reboot or topology change)
              END,
              accumulated_tx = host_network_usage.accumulated_tx + CASE 
                WHEN ${currentTx} >= host_network_usage.last_raw_tx THEN (${currentTx} - host_network_usage.last_raw_tx)
                ELSE ${currentTx} -- Reset detection
              END,
              last_raw_rx = ${currentRx},
              last_raw_tx = ${currentTx},
              updated_at = now()
            RETURNING accumulated_rx, accumulated_tx;
          `;
          
          if (usageResult.length > 0) {
            monthlyTotal = (toFiniteNumber(usageResult[0].accumulated_rx) ?? 0) + (toFiniteNumber(usageResult[0].accumulated_tx) ?? 0);
          }
        } catch (e) {
          console.error('[docker-proxy] network usage upsert failed', e);
        }
      }

      const normalizedMetrics = createHostMetricsPoint({
        ...metricsData,
        network_monthly_total: monthlyTotal > 0 ? monthlyTotal : null
      });

      if (!normalizedMetrics) {
        return createProblemResponse(502, "Host metrics unavailable", "Agent returned a success response without a usable metrics sample", "malformed_metrics_payload");
      }

      await sql`
        UPDATE docker_hosts
        SET status = 'connected',
            last_seen_at = now()
        WHERE id = ${hostId}
      `;

      return new Response(JSON.stringify(normalizedMetrics), {
        headers: corsHeaders,
      });
    }

    let dockerPath: string;
    let method = 'GET';
    let timeoutMs = 5000;

    switch (action) {
      case 'ping': dockerPath = '/_ping'; timeoutMs = 3000; break;
      case 'info': dockerPath = '/info'; timeoutMs = 3000; break;
      case 'version': dockerPath = '/version'; timeoutMs = 3000; break;
      case 'containers': dockerPath = '/containers/json?all=true'; timeoutMs = 5000; break;
      case 'container-inspect': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/json`; 
        timeoutMs = 5000;
        break;
      case 'container-stats': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/stats?stream=false`; 
        timeoutMs = 5000;
        break;
      case 'container-logs': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        {
          const entitlements = await resolveOrganizationEntitlements({
            organizationId: host.organization_id,
            isPlatformAdmin: auth.isPlatformAdmin,
          });
          if (!entitlements.canUseLogs) {
            return createProblemResponse(
              403,
              "Logs require a paid subscription",
              "Container logs require an Individual, Business, or Dedicated subscription.",
              "feature_not_allowed",
            );
          }
          const requestedTail = Number((params as any)?.tail) || 100;
          const tail = Math.min(Math.max(1, requestedTail), entitlements.logTailLines);
          const since = (params as any)?.since ? `&since=${(params as any).since}` : '';
          const until = (params as any)?.until ? `&until=${(params as any).until}` : '';
          dockerPath = `/containers/${sanitizeContainerId(containerId)}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true${since}${until}`; 
          timeoutMs = 6000;
          // Store entitlements for use during fetch
          (params as any).__maxPayloadBytes = entitlements.maxPayloadBytes;
        }
        break;
      case 'container-start': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/start`; method = 'POST'; 
        timeoutMs = 8000;
        break;
      case 'container-stop': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/stop`; method = 'POST'; 
        timeoutMs = 8000;
        break;
      case 'container-restart': 
        if (!containerId) return createProblemResponse(400, "containerId required");
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/restart`; method = 'POST'; 
        timeoutMs = 8000;
        break;

      case 'container-fs-list': {
        if (!containerId) return createProblemResponse(400, "containerId required");

        // ── Entitlement check ──
        {
          const entitlements = await resolveOrganizationEntitlements({
            organizationId: host.organization_id,
            isPlatformAdmin: auth.isPlatformAdmin,
          });
          if (!entitlements.canUseFileManager) {
            return createProblemResponse(
              403,
              "File Manager requires a paid subscription",
              "The File Manager requires an Individual, Business, or Dedicated subscription.",
              "feature_not_allowed",
            );
          }
        }

        const fsPath = (params as any)?.path || '/';
        if (typeof fsPath !== 'string' || !fsPath.startsWith('/') || fsPath.includes('..')) {
          return createProblemResponse(400, "Invalid path", "Path must be absolute and must not contain '..'");
        }

        const sanitizedId = sanitizeContainerId(containerId);

        // Use Docker's archive API to fetch the directory contents as a tar
        // stream. This avoids spawning `sh -c` in the container, eliminating
        // the shell-injection surface flagged in the prior security audit.
        const encodedDirPath = encodeURIComponent(fsPath);
        const archiveReq = buildRequest(
          host as any,
          secrets,
          `/containers/${sanitizedId}/archive?path=${encodedDirPath}`,
          'GET',
        );

        const archiveResp = await dockerFetch(archiveReq.url, archiveReq.method, archiveReq.headers, 10000);

        if (!archiveResp.ok) {
          const detail = await archiveResp.text();
          if (archiveResp.status === 404) {
            return createProblemResponse(404, "Directory not found", `${fsPath} does not exist in this container`);
          }
          if (archiveResp.status === 400) {
            return createProblemResponse(400, "Not a directory", `${fsPath} is not a directory`);
          }
          return createProblemResponse(
            archiveResp.status || 502,
            "Failed to list directory",
            detail,
          );
        }

        const tarBytes = new Uint8Array(await archiveResp.arrayBuffer());

        // Cap directory listing tar size — a directory with thousands of
        // large files could otherwise produce an arbitrarily large response.
        const MAX_LISTING_TAR = 8 * 1024 * 1024;
        if (tarBytes.length > MAX_LISTING_TAR) {
          return createProblemResponse(
            413,
            "Directory listing too large",
            "This directory contains too many or too large entries to list in a single request.",
          );
        }

        const entries = parseTarDirectory(tarBytes);

        return new Response(JSON.stringify({ entries, path: fsPath }), { headers: corsHeaders });
      }

      case 'container-fs-read': {
        if (!containerId) return createProblemResponse(400, "containerId required");

        // ── Entitlement check ──
        {
          const entitlements = await resolveOrganizationEntitlements({
            organizationId: host.organization_id,
            isPlatformAdmin: auth.isPlatformAdmin,
          });
          if (!entitlements.canUseFileManager) {
            return createProblemResponse(
              403,
              "File Manager requires a paid subscription",
              "The File Manager requires an Individual, Business, or Dedicated subscription.",
              "feature_not_allowed",
            );
          }
        }

        const readPath = (params as any)?.path;
        if (typeof readPath !== 'string' || !readPath.startsWith('/') || readPath.includes('..')) {
          return createProblemResponse(400, "Invalid path", "Path must be absolute and must not contain '..'");
        }

        const sanitizedReadId = sanitizeContainerId(containerId);
        const encodedPath = encodeURIComponent(readPath);
        const archiveReq = buildRequest(
          host as any,
          secrets,
          `/containers/${sanitizedReadId}/archive?path=${encodedPath}`,
          'GET',
        );

        const archiveResp = await dockerFetch(archiveReq.url, archiveReq.method, archiveReq.headers, 10000);

        if (!archiveResp.ok) {
          const detail = await archiveResp.text();
          if (archiveResp.status === 404) {
            return createProblemResponse(404, "File not found", `${readPath} does not exist in this container`);
          }
          return createProblemResponse(
            archiveResp.status || 502,
            "Failed to read file",
            detail,
          );
        }

        // Docker archive returns a tar stream. Extract the single file.
        const tarBytes = new Uint8Array(await archiveResp.arrayBuffer());

        // 2MB limit for file content to prevent abuse
        const MAX_FILE_READ = 2 * 1024 * 1024;

        // Parse tar header (standard POSIX tar format)
        // Header is 512 bytes. File name at offset 0 (100 bytes), size at offset 124 (12 bytes, octal)
        if (tarBytes.length < 512) {
          return createProblemResponse(502, "Invalid archive response", "Tar stream too short");
        }

        const sizeOctal = new TextDecoder().decode(tarBytes.slice(124, 136)).replace(/\0/g, '').trim();
        const fileSize = parseInt(sizeOctal, 8);

        if (!Number.isFinite(fileSize) || fileSize < 0) {
          return createProblemResponse(502, "Invalid archive response", "Could not parse file size from tar header");
        }

        const truncated = fileSize > MAX_FILE_READ;
        const readSize = Math.min(fileSize, MAX_FILE_READ);

        // File data starts at offset 512
        const fileData = tarBytes.slice(512, 512 + readSize);

        // Detect if binary by checking for null bytes in the first 8KB
        const sampleSize = Math.min(fileData.length, 8192);
        let isBinary = false;
        for (let i = 0; i < sampleSize; i++) {
          if (fileData[i] === 0) {
            isBinary = true;
            break;
          }
        }

        if (isBinary) {
          return new Response(JSON.stringify({
            content: '',
            size: fileSize,
            truncated: false,
            binary: true,
            message: 'Binary file — download is not supported in the current version.',
          }), { headers: corsHeaders });
        }

        const content = new TextDecoder().decode(fileData);

        return new Response(JSON.stringify({
          content,
          size: fileSize,
          truncated,
          binary: false,
        }), { headers: corsHeaders });
      }

      default:
        return createProblemResponse(400, `Unknown action: ${action}`);
    }

    const reqData = buildRequest(host as any, secrets, dockerPath, method);



    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      const idempotencyKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
      if (!idempotencyKey) {
        return createProblemResponse(400, "Missing Idempotency Key", "Mutations require an Idempotency-Key header for safety.");
      }
      await assertOrganizationWriteAllowed({
        organizationId: host.organization_id,
        isPlatformAdmin: auth.isPlatformAdmin,
      });
    }

    const maxPayloadBytes = (params as any)?.__maxPayloadBytes;
    const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers, timeoutMs, maxPayloadBytes || undefined);

    if (action === 'ping') {
      const text = await dockerResponse.text();
      const statusText = formatDiagnosticDetail(parseDiagnosticPayload(text)) ?? trimDiagnostic(text.replace(/\s+/g, ' ').trim());
      const ok = dockerResponse.ok;

      if (!ok) {
        const upstreamStatus = dockerResponse.status || 502;
        const agentApiKeyFailure = isAgentApiKeyFailure(upstreamStatus, text);
        const parsedDetails = parseDiagnosticPayload(text);
        const dockerSocketFailure = isAgentDockerSocketFailure(parsedDetails);
        await sql`
          UPDATE docker_hosts
          SET status = 'error'
          WHERE id = ${hostId}
        `;

        const detail = summarizeAgentConnectionFailure(upstreamStatus, text, host.connection_mode);

        if (agentApiKeyFailure) {
          return createAgentUnauthorizedResponse(upstreamStatus, detail, corsHeaders);
        }

        if (dockerSocketFailure) {
          return createProblemResponse(
            502,
            'Docker socket unavailable',
            detail,
            'docker_socket_unavailable',
          );
        }

        return createProblemResponse(
          upstreamStatus,
          'Connection test failed',
          detail,
          'agent_connection_failed',
        );
      }

      let dockerVersion = null;
      let agentVersion = null;
      let agentVersionError = null;
      let osInfo = null;
      try {
        const vReq = buildRequest(host as any, secrets, '/version', 'GET');
        const vResp = await dockerFetch(vReq.url, vReq.method, vReq.headers, 5000);
        if (vResp.ok) {
          const vData = await vResp.json();
          dockerVersion = vData.Version || null;
          osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null;
        }
      } catch (_) {}

      const agentVersionReport = await fetchAgentVersionReport(host as any, secrets);
      agentVersion = agentVersionReport.agentVersion;
      agentVersionError = agentVersionReport.agentVersionError;
      if (agentVersionError) {
        console.warn('[docker-proxy] agent version lookup failed', {
          hostId: hostId,
          hostUrl: host.host_url,
          error: agentVersionError,
        });
      }

      const releaseResponse = buildWatchtowerAgentReleaseResponse(agentVersion);
      const agentNeedsUpdate = releaseResponse.agent_update_status === 'update_required';

      await sql`
        UPDATE docker_hosts 
        SET status = ${ok ? 'connected' : 'error'}, 
            last_seen_at = now(),
            docker_version = COALESCE(${dockerVersion}, docker_version),
            agent_version = COALESCE(${agentVersion}, agent_version),
            os_info = COALESCE(${osInfo}, os_info)
        WHERE id = ${hostId}
      `;

      return new Response(JSON.stringify({
        ok,
        status: statusText,
        docker_version: dockerVersion,
        agent_version: agentVersion,
        os_info: osInfo,
        connection_mode: host.connection_mode,
        agent_version_error: agentVersionError,
        ...releaseResponse,
        agent_update_available: agentNeedsUpdate,
      }), { headers: corsHeaders });
    }

    if (action === 'container-logs') {
      if (dockerResponse.status === 413) {
        return createProblemResponse(413, "Logs too large", "Payload exceeded your plan's log size limit. Upgrade for higher limits.");
      }
      if (!dockerResponse.ok) {
        const rawDetails = await dockerResponse.text();
        const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(rawDetails));
        return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
      }
      const rawBytes = new Uint8Array(await dockerResponse.arrayBuffer());
      const lines: string[] = [];
      let offset = 0;
      while (offset + 8 <= rawBytes.length) {
        const size = (rawBytes[offset + 4] << 24) | (rawBytes[offset + 5] << 16) | (rawBytes[offset + 6] << 8) | rawBytes[offset + 7];
        offset += 8;
        if (offset + size <= rawBytes.length) {
          lines.push(new TextDecoder().decode(rawBytes.slice(offset, offset + size)).trimEnd());
        }
        offset += size;
      }
      if (lines.length === 0) lines.push(...(new TextDecoder().decode(rawBytes)).split('\n').filter(Boolean));
      return new Response(JSON.stringify({ logs: lines }), { headers: corsHeaders });
    }

    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      const text = await dockerResponse.text();
      const ok = dockerResponse.status === 204 || dockerResponse.status === 304 || dockerResponse.ok;
      if (!ok) {
        const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(text));
        return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok, status: dockerResponse.status, message: formatDiagnosticDetail(parseDiagnosticPayload(text)) ?? "" }), { headers: corsHeaders });
    }

    if (!dockerResponse.ok) {
      const rawDetails = await dockerResponse.text();
      const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(rawDetails));
      return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
    }

    const payload = await dockerResponse.json();
    const responseHeaders = { ...corsHeaders };

    if (req.method === 'GET') {
      responseHeaders['Cache-Control'] = 'private, max-age=0, must-revalidate';
    }
    return new Response(JSON.stringify(payload), { headers: responseHeaders });

  } catch (error: any) {
    if (error instanceof SecretCryptoError) {
      return createProblemResponse(500, 'Secret storage failed', error.message);
    }
    const classified = classifyTopLevelProxyError(error);
    return createProblemResponse(classified.status, classified.title, classified.detail, classified.type);
  }
};

export const config: Config = {
  path: '/api/docker-proxy',
};
