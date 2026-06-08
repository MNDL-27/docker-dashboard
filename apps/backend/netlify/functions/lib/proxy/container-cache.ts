import { sql } from '../db.mjs';
import { ensureDockerHostSchema } from '../ensure-docker-host-schema.mjs';
import { decryptHostSecrets } from '../crypto.mjs';
import { buildRequest, dockerFetch } from './client';
import { mapConcurrent } from './utils';
import type { AuthContext } from './types';

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CachedContainerList {
  hostId: string;
  hostName: string;
  containers: Record<string, unknown>[];
  cachedAt: Date;
}

let cacheSchemaEnsured = false;

export async function ensureContainerCacheSchema() {
  if (cacheSchemaEnsured) return;
  await ensureDockerHostSchema();
  cacheSchemaEnsured = true;
}

export async function getCachedContainerList(hostId: string): Promise<CachedContainerList | null> {
  await ensureContainerCacheSchema();

  const rows = await sql`
    SELECT c.host_id, c.cached_at, c.containers, h.name as host_name
    FROM container_list_cache c
    JOIN docker_hosts h ON h.id = c.host_id
    WHERE c.host_id = ${hostId}
      AND c.cached_at > now() - interval '30 seconds'
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    hostId: row.host_id,
    hostName: row.host_name,
    containers: row.containers,
    cachedAt: new Date(row.cached_at),
  };
}

export async function setCachedContainerList(
  hostId: string,
  containers: Record<string, unknown>[],
): Promise<void> {
  await ensureContainerCacheSchema();

  await sql`
    INSERT INTO container_list_cache (host_id, cached_at, containers)
    VALUES (${hostId}, now(), ${JSON.stringify(containers)}::jsonb)
    ON CONFLICT (host_id) DO UPDATE SET
      cached_at = now(),
      containers = ${JSON.stringify(containers)}::jsonb
  `;
}

export async function invalidateContainerCache(hostId: string): Promise<void> {
  await ensureContainerCacheSchema();

  await sql`DELETE FROM container_list_cache WHERE host_id = ${hostId}`;
}

export async function getCachedContainersForOrg(
  auth: AuthContext,
  corsHeaders: Record<string, string>,
  createProblemResponse: (status: number, title: string, detail?: string, type?: string) => Response,
) {
  const { sql: dbSql } = await import('../db.mjs');
  const { enforceOrganizationNodeLimit } = await import('../access-controls.mjs');

  const orgId = auth.orgId;
  if (!orgId) return createProblemResponse(400, "orgId required");

  const memberships = await dbSql`
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

  const hosts = await dbSql`
    SELECT h.*
    FROM docker_hosts h
    LEFT JOIN docker_host_admin_controls hac ON hac.host_id = h.id
    WHERE h.organization_id = ${orgId}
      AND h.id = ANY(${limitState.allowedHostIds})
      AND COALESCE(hac.is_quarantined, false) = false
  `;

  const allContainers: Record<string, unknown>[] = [];
  const staleHosts: Record<string, unknown>[] = [];

  // Check cache for each host
  await mapConcurrent(hosts as Record<string, unknown>[], 50, async (host) => {
    const cached = await getCachedContainerList(host.id);
    if (cached) {
      allContainers.push(...cached.containers.map((c: Record<string, unknown>) => ({
        ...c,
        _hostId: host.id,
        _hostName: host.name,
      })));
    } else {
      staleHosts.push(host);
    }
  });

  // Fetch stale hosts from agents
  if (staleHosts.length > 0) {
    await mapConcurrent(staleHosts as Record<string, unknown>[], 50, async (host) => {
      try {
        const secretsRecord = await dbSql`
          SELECT agent_api_key, cf_service_token_id, cf_service_token_secret
          FROM docker_host_secrets WHERE host_id = ${host.id}
        `;
        const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

        const { url, method, headers: reqHeaders } = buildRequest(host, secrets, '/containers/json?all=true', 'GET');
        const resp = await dockerFetch(url, method, reqHeaders, 3000);

        if (resp.ok && resp.status !== 413) {
          const containers = await resp.json();
          const tagged = (containers as Record<string, unknown>[]).map((c) => ({ ...c, _hostId: host.id, _hostName: host.name }));
          allContainers.push(...tagged);
          await setCachedContainerList(host.id, tagged);
          await dbSql`UPDATE docker_hosts SET status = 'connected', last_seen_at = now(), consecutive_failures = 0, last_error = null WHERE id = ${host.id}`;
        } else {
          await dbSql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
        }
      } catch (_e) {
        await dbSql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
      }
    });
  }

  return new Response(JSON.stringify(allContainers), {
    headers: corsHeaders,
  });
}
