import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { decryptHostSecrets } from './lib/crypto.mjs';
import { buildValidatedAgentUrl } from './lib/host-url.mjs';
import {
  createScanQuotaExceededResponse,
  recordOrganizationScan,
  withScanQuotaHeaders,
} from './lib/scan-quota.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

interface FleetMetricsPoint {
  timestamp: number;
  time: string;
  cpu: number;
  memory: number;
  usedCores: number;
  totalCores: number;
  memoryUsed: number;
  memoryLimit: number;
  networkInBytesPerSec: number | null;
  networkOutBytesPerSec: number | null;
  diskReadBytesPerSec: number | null;
  diskWriteBytesPerSec: number | null;
  reportingHosts: number;
  totalHosts: number;
  isPartial: boolean;
}

interface HostMetricsResponse {
  cpu_time_ns: number;
  system_time_ns: number;
  online_cpus: number;
  memory_used: number;
  memory_limit: number;
  network_in_bytes_per_sec: number | null;
  network_out_bytes_per_sec: number | null;
  disk_read_bytes_per_sec: number | null;
  disk_write_bytes_per_sec: number | null;
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

async function fetchHostMetrics(hostUrl: string, apiKey: string, timeoutMs = 5000): Promise<HostMetricsResponse | null> {
  try {
    const response = await fetch(buildValidatedAgentUrl(hostUrl, '/metrics'), {
      headers: {
        'X-Agent-Key': apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Agent returns CPU/memory fields and may include optional network/disk rates.
    return { 
      cpu_time_ns: Math.max(0, toFiniteNumber(data.cpu_time_ns) ?? 0),
      system_time_ns: Math.max(0, toFiniteNumber(data.system_time_ns) ?? 0),
      online_cpus: Math.max(1, toFiniteNumber(data.online_cpus) ?? 1),
      memory_used: Math.max(0, toFiniteNumber(data.memory_used) ?? 0),
      memory_limit: Math.max(0, toFiniteNumber(data.memory_limit) ?? 0),
      network_in_bytes_per_sec: normalizeOptionalRate(data.network_in_bytes_per_sec ?? data.networkInBytesPerSec),
      network_out_bytes_per_sec: normalizeOptionalRate(data.network_out_bytes_per_sec ?? data.networkOutBytesPerSec),
      disk_read_bytes_per_sec: normalizeOptionalRate(data.disk_read_bytes_per_sec ?? data.diskReadBytesPerSec),
      disk_write_bytes_per_sec: normalizeOptionalRate(data.disk_write_bytes_per_sec ?? data.diskWriteBytesPerSec),
    };
  } catch {
    return null;
  }
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const auth = await requireAuth(req);
    const orgId = auth.orgId;

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Active org required' }), { status: 400, headers });
    }

    // Verify user has access to org
    const memberships = await sql`
      SELECT 1 FROM organization_members 
      WHERE organization_id = ${orgId} AND user_id = ${auth.userId}
    `;
    if (memberships.length === 0) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers });
    }

    // Get all hosts for the org
    const hosts = await sql`
      SELECT h.id, h.host_url, h.name 
      FROM docker_hosts h
      WHERE h.organization_id = ${orgId}
    `;

    if (hosts.length === 0) {
      return new Response(JSON.stringify([]), { headers });
    }

    // Fetch secrets and metrics for each host concurrently
    const now = new Date();
    const timestamp = now.getTime();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    const connectedHostIds: string[] = [];

    const metricsPromises = hosts.map(async (host) => {
      try {
        // Get decrypted secrets for this host
        const secretsRecord = await sql`
          SELECT agent_api_key 
          FROM docker_host_secrets 
          WHERE host_id = ${host.id}
        `;

        if (secretsRecord.length === 0 || !secretsRecord[0].agent_api_key) {
          return null;
        }

        const decryptedSecrets = decryptHostSecrets(secretsRecord[0], host.id);
        const apiKey = decryptedSecrets?.agent_api_key;
        if (!apiKey) return null;

        const metrics = await fetchHostMetrics(host.host_url, apiKey);
        if (metrics) connectedHostIds.push(host.id);
        return metrics;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(metricsPromises);

    // Update heartbeat for hosts that returned valid metrics
    if (connectedHostIds.length > 0) {
      try {
        await sql`
          UPDATE docker_hosts
          SET status = 'connected', last_seen_at = now(), consecutive_failures = 0
          WHERE id = ANY(${connectedHostIds})
        `;
      } catch (e) {
        console.error('[fleet-metrics] heartbeat update failed', e);
      }
    }

     // Aggregate: calculate fleet-wide CPU and memory utilization
     // For CPU: 
     //   Used cores = Σ[(cpu_time_ns / system_time_ns) * online_cpus] 
     //   Total capacity = Σ[online_cpus]
     //   Utilization % = (Used cores / Total capacity) * 100
     // For Memory:
     //   Utilization % = (totalMemoryUsed / totalMemoryLimit) * 100
     let totalCpuUsedCores = 0;     // total CPU cores used across fleet
     let totalCpuCapacityCores = 0; // total CPU cores available across fleet
     let totalMemoryUsed = 0;       // bytes
     let totalMemoryLimit = 0;      // bytes
     let networkInSum = 0;
     let networkInCount = 0;
     let networkOutSum = 0;
     let networkOutCount = 0;
     let diskReadSum = 0;
     let diskReadCount = 0;
     let diskWriteSum = 0;
     let diskWriteCount = 0;
     let hostCount = 0;

     results.forEach((result) => {
       if (result && result.system_time_ns > 0) {
         // Calculate used cores for this host: (cpu_time_ns / system_time_ns) * online_cpus
         const hostUsedCores = (result.cpu_time_ns / result.system_time_ns) * result.online_cpus;
         // Add to fleet totals
         totalCpuUsedCores += hostUsedCores;
          totalCpuCapacityCores += result.online_cpus;
          totalMemoryUsed += result.memory_used;
          totalMemoryLimit += result.memory_limit;

          if (result.network_in_bytes_per_sec !== null) {
            networkInSum += result.network_in_bytes_per_sec;
            networkInCount++;
          }
          if (result.network_out_bytes_per_sec !== null) {
            networkOutSum += result.network_out_bytes_per_sec;
            networkOutCount++;
          }
          if (result.disk_read_bytes_per_sec !== null) {
            diskReadSum += result.disk_read_bytes_per_sec;
            diskReadCount++;
          }
          if (result.disk_write_bytes_per_sec !== null) {
            diskWriteSum += result.disk_write_bytes_per_sec;
            diskWriteCount++;
          }

          hostCount++;
        }
      });

     // Compute percentages
     // CPU: Fleet utilization percentage = (used cores / total capacity cores) * 100
     // Memory: Fleet utilization percentage = (used memory / total memory) * 100
     let cpuPercent = 0;
     let memPercent = 0;
     
     if (hostCount > 0) {
       // Memory: true fleet-wide percentage
       if (totalMemoryLimit > 0) {
         memPercent = Math.round((totalMemoryUsed / totalMemoryLimit) * 100);
       }
       
       // CPU: Fleet CPU utilization percentage
       if (totalCpuCapacityCores > 0) {
         cpuPercent = Math.round((totalCpuUsedCores / totalCpuCapacityCores) * 100);
       }
     }

      const fleetMetrics: FleetMetricsPoint[] = [{
         timestamp,
         time: timeStr,
         cpu: cpuPercent,
         memory: memPercent,
        usedCores: Math.round(totalCpuUsedCores * 100) / 100, // keep 2 decimal places for display
        totalCores: Math.round(totalCpuCapacityCores * 100) / 100,
        memoryUsed: totalMemoryUsed,
        memoryLimit: totalMemoryLimit,
        networkInBytesPerSec: networkInCount > 0 ? networkInSum : null,
        networkOutBytesPerSec: networkOutCount > 0 ? networkOutSum : null,
        diskReadBytesPerSec: diskReadCount > 0 ? diskReadSum : null,
        diskWriteBytesPerSec: diskWriteCount > 0 ? diskWriteSum : null,
        reportingHosts: hostCount,
        totalHosts: hosts.length,
        isPartial: hostCount > 0 && hostCount < hosts.length,
      }];

    const scan = await recordOrganizationScan(orgId);
    if (scan.exhausted) {
      return createScanQuotaExceededResponse(scan, headers);
    }

    return new Response(JSON.stringify(fleetMetrics), {
      headers: withScanQuotaHeaders(headers, scan, scan.counted),
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to fetch fleet metrics', details: error.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/fleet-metrics',
};
