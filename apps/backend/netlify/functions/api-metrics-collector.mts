import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import crypto from 'node:crypto';
import { sql } from './lib/db.mjs';
import { decryptHostSecrets } from './lib/crypto.mjs';
import { buildAgentRequest, dockerFetch } from './lib/proxy/client';
import { createHostMetricsPoint } from './lib/proxy/metrics';
import { toFiniteNumber } from './lib/proxy/utils';
import { ensureDockerHostSchema } from './lib/ensure-docker-host-schema.mjs';
import { enforceOrganizationNodeLimit } from './lib/access-controls.mjs';

const buildHeaders = (req: Request) => buildCorsHeaders(req);

function isAuthorizedSchedulerRequest(req: Request) {
  const expectedSecret = (process.env.METRICS_COLLECTOR_SECRET || '').trim();
  if (!expectedSecret) return false;
  const providedSecret = (req.headers.get('x-cron-secret') || '').trim();
  const expectedBuf = Buffer.from(expectedSecret);
  const providedBuf = Buffer.from(providedSecret);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

async function collectMetricsForHost(
  host: any,
  secrets: any,
): Promise<{ hostId: string; metrics: any } | null> {
  try {
    const metricsReq = buildAgentRequest(host, secrets, '/metrics', 'GET');
    const metricsResponse = await dockerFetch(metricsReq.url, metricsReq.method, metricsReq.headers, 5000);

    if (!metricsResponse.ok) {
      console.warn('[metrics-collector] metrics fetch failed', {
        hostId: host.id,
        status: metricsResponse.status,
      });
      return null;
    }

    const metricsData = await metricsResponse.json();
    const normalizedMetrics = createHostMetricsPoint(metricsData);
    if (!normalizedMetrics) return null;

    return { hostId: host.id, metrics: normalizedMetrics };
  } catch (err: any) {
    console.warn('[metrics-collector] collection failed', {
      hostId: host.id,
      error: err?.message,
    });
    return null;
  }
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    await ensureDockerHostSchema();

    if (!isAuthorizedSchedulerRequest(req)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: buildHeaders(req) });
    }

    const orgRows = await sql<Array<{ organization_id: string | null }>>`
      SELECT DISTINCT organization_id
      FROM docker_hosts
      WHERE organization_id IS NOT NULL
    `;

    const allowedHostIds: string[] = [];
    for (const row of orgRows) {
      if (!row.organization_id) continue;
      const limitState = await enforceOrganizationNodeLimit({
        organizationId: row.organization_id,
        isPlatformAdmin: false,
      });
      allowedHostIds.push(...limitState.allowedHostIds);
    }

    if (allowedHostIds.length === 0) {
      return new Response(JSON.stringify({ collected: 0, message: 'No eligible hosts' }), { headers: buildHeaders(req) });
    }

    const hosts = await sql`
      SELECT *
      FROM docker_hosts
      WHERE id = ANY(${allowedHostIds}) AND status = 'connected'
    `;

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ collected: 0, message: 'No connected hosts' }), { headers: buildHeaders(req) });
    }

    const results: any[] = [];
    const collectedAt = new Date().toISOString();

    await Promise.allSettled(hosts.map(async (host) => {
      try {
        const secretsRecord = await sql`
          SELECT agent_api_key, cf_service_token_id, cf_service_token_secret
          FROM docker_host_secrets WHERE host_id = ${host.id}
        `;
        const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

        const result = await collectMetricsForHost(host, secrets);
        if (!result) return;

        const m = result.metrics;

        await sql`
          INSERT INTO host_metrics_cache (
            host_id, collected_at,
            cpu, memory, used_cores, total_cores,
            memory_used, memory_limit,
            network_in_bytes_per_sec, network_out_bytes_per_sec,
            network_monthly_total,
            disk_read_bytes_per_sec, disk_write_bytes_per_sec,
            uptime_seconds, disks
          ) VALUES (
            ${host.id}, ${collectedAt},
            ${m.cpu}, ${m.memory}, ${m.usedCores}, ${m.totalCores},
            ${m.memoryUsed}, ${m.memoryLimit},
            ${m.networkInBytesPerSec}, ${m.networkOutBytesPerSec},
            ${m.networkMonthlyTotal},
            ${m.diskReadBytesPerSec}, ${m.diskWriteBytesPerSec},
            ${m.uptimeSeconds}, ${JSON.stringify(m.disks)}::jsonb
          )
        `;

        results.push({ hostId: host.id, name: host.name, ok: true });
      } catch (err: any) {
        console.error('[metrics-collector] host failed', { hostId: host.id, error: err?.message });
        results.push({ hostId: host.id, name: host.name, ok: false, error: err?.message });
      }
    }));

    // Prune old cache entries (keep last 6 hours per host)
    await sql`
      DELETE FROM host_metrics_cache
      WHERE collected_at < now() - interval '6 hours'
    `;

    return new Response(JSON.stringify({
      collected: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      total: hosts.length,
      results,
      timestamp: collectedAt,
    }), { headers: buildHeaders(req) });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: buildHeaders(req) });
  }
};

export const config: Config = {
  path: '/api/metrics-collector',
};
