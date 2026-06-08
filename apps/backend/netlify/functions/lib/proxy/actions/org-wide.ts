import { sql } from '../../db.mjs';
import { decryptHostSecrets } from '../../crypto.mjs';
import { enforceOrganizationNodeLimit } from '../../access-controls.mjs';
import { buildRequest } from '../client';
import { dockerFetch } from '../client';
import { mapConcurrent } from '../utils';
import type { AuthContext } from '../types';

export async function handleAllContainers(
  auth: AuthContext,
  corsHeaders: Record<string, string>,
  createProblemResponse: (status: number, title: string, detail?: string, type?: string) => Response,
) {
  const orgId = auth.orgId;
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

  await mapConcurrent(hosts as any[], 50, async (host) => {
    try {
      const secretsRecord = await sql`
        SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
        FROM docker_host_secrets WHERE host_id = ${host.id}
      `;
      const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

      const { url, method, headers: reqHeaders } = buildRequest(host, secrets, '/containers/json?all=true', 'GET');
      const resp = await dockerFetch(url, method, reqHeaders, 3000);
      
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

export async function handleAllContainerStats(
  auth: AuthContext,
  corsHeaders: Record<string, string>,
  createProblemResponse: (status: number, title: string, detail?: string, type?: string) => Response,
) {
  const orgId = auth.orgId;
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
  const allStats: any[] = [];

  await mapConcurrent(hosts as any[], 50, async (host) => {
    try {
      const secretsRecord = await sql`
        SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
        FROM docker_host_secrets WHERE host_id = ${host.id}
      `;
      const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

      const listReq = buildRequest(host, secrets, '/containers/json', 'GET');
      const listResp = await dockerFetch(listReq.url, listReq.method, listReq.headers, 3000);
      if (!listResp.ok) return;
      const containers = await listResp.json();
      if (!Array.isArray(containers) || containers.length === 0) return;

      await sql`UPDATE docker_hosts SET status = 'connected', last_seen_at = now(), consecutive_failures = 0 WHERE id = ${host.id}`;

      const capped = containers.slice(0, 100);

      await mapConcurrent(capped, 20, async (container: any) => {
        try {
          const cId = container.Id;
          const statsReq = buildRequest(host, secrets, `/containers/${cId}/stats?stream=false`, 'GET');
          const statsResp = await dockerFetch(statsReq.url, statsReq.method, statsReq.headers, 5000);
          if (!statsResp.ok) return;
          const s = await statsResp.json();

          const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage ?? 0) - (s.precpu_stats?.cpu_usage?.total_usage ?? 0);
          const systemDelta = (s.cpu_stats?.system_cpu_usage ?? 0) - (s.precpu_stats?.system_cpu_usage ?? 0);
          const onlineCpus = s.cpu_stats?.online_cpus || 1;
          const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

          const memUsage = s.memory_stats?.usage ?? 0;
          const memLimit = s.memory_stats?.limit ?? 0;

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
