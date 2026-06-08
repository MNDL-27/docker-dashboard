import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { buildCorsHeaders } from './lib/security.mjs';
import { buildClerkAuthFromRequest } from './lib/auth.mjs';
import { ensureDockerHostSchema } from './lib/ensure-docker-host-schema.mjs';

const buildHeaders = (req: Request) => buildCorsHeaders(req);

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    await ensureDockerHostSchema();

    const authResult = await buildClerkAuthFromRequest(req);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: buildHeaders(req) });
    }

    const url = new URL(req.url);
    const hostId = url.searchParams.get('hostId');
    if (!hostId) {
      return new Response(JSON.stringify({ error: 'hostId is required' }), { status: 400, headers: buildHeaders(req) });
    }

    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(1, Number(limitParam) || 24), 100);

    // Verify host belongs to user's org
    const hostCheck = await sql`
      SELECT h.id FROM docker_hosts h
      JOIN organization_members om ON h.organization_id = om.organization_id
      WHERE h.id = ${hostId} AND om.user_id = ${authResult.userId}
    `;

    if (hostCheck.length === 0) {
      return new Response(JSON.stringify({ error: 'Host not found' }), { status: 404, headers: buildHeaders(req) });
    }

    const rows = await sql`
      SELECT
        collected_at as "collectedAt",
        cpu, memory,
        used_cores as "usedCores",
        total_cores as "totalCores",
        memory_used as "memoryUsed",
        memory_limit as "memoryLimit",
        network_in_bytes_per_sec as "networkInBytesPerSec",
        network_out_bytes_per_sec as "networkOutBytesPerSec",
        network_monthly_total as "networkMonthlyTotal",
        disk_read_bytes_per_sec as "diskReadBytesPerSec",
        disk_write_bytes_per_sec as "diskWriteBytesPerSec",
        uptime_seconds as "uptimeSeconds",
        disks
      FROM host_metrics_cache
      WHERE host_id = ${hostId}
      ORDER BY collected_at DESC
      LIMIT ${limit}
    `;

    // Check staleness: latest entry older than 2 minutes
    const latest = rows[0]?.collectedAt;
    const isStale = !latest || (Date.now() - new Date(latest).getTime()) > 2 * 60 * 1000;

    return new Response(JSON.stringify({
      hostId,
      metrics: rows,
      latest: rows[0] || null,
      stale: isStale,
      collectedAt: latest,
    }), { headers: buildHeaders(req) });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: buildHeaders(req) });
  }
};

export const config: Config = {
  path: '/api/host-metrics-cached',
};
