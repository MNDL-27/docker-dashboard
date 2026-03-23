import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { decryptSecret } from './lib/crypto.mts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

interface FleetMetricsPoint {
  time: string;
  cpu: number;
  memory: number;
}

async function fetchHostMetrics(hostUrl: string, apiKey: string, timeoutMs = 5000): Promise<{ cpu_usage: number; memory_used: number; memory_limit: number } | null> {
  try {
    const response = await fetch(`${hostUrl.replace(/\/$/, '')}/metrics`, {
      headers: {
        'X-Agent-Key': apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Agent now returns raw values: cpu_usage (ns), memory_used (bytes), memory_limit (bytes)
    return { 
      cpu_usage: data.cpu_usage || 0, 
      memory_used: data.memory_used || 0,
      memory_limit: data.memory_limit || 0
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
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

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

        const apiKey = decryptSecret(secretsRecord[0].agent_api_key, host.id, 'agent_api_key');
        if (!apiKey) return null;

        const metrics = await fetchHostMetrics(host.host_url, apiKey);
        return metrics;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(metricsPromises);

    // Aggregate RAW values from all successful hosts
    let totalCpuUsage = 0;      // nanoseconds (sum across hosts)
    let totalMemoryUsed = 0;    // bytes (sum across hosts)
    let totalMemoryLimit = 0;   // bytes (sum across hosts)
    let hostCount = 0;

    results.forEach((result) => {
      if (result) {
        totalCpuUsage += result.cpu_usage;
        totalMemoryUsed += result.memory_used;
        totalMemoryLimit += result.memory_limit;
        hostCount++;
      }
    });

    // Compute percentages from TOTALS (not average of averages)
    // Memory: fleet-wide percentage = total_used / total_limit * 100
    // CPU: for display, show as percentage of available CPU (normalized by host count to keep in 0-100 range)
    // Since CPU raw usage is time-dependent, we convert to a representative percentage
    // by normalizing against a baseline (1 second of full CPU = 1e9 nanoseconds)
    let cpuPercent = 0;
    let memPercent = 0;
    
    if (hostCount > 0) {
      // Memory: true fleet-wide percentage (sum used / sum limit)
      if (totalMemoryLimit > 0) {
        memPercent = Math.round((totalMemoryUsed / totalMemoryLimit) * 100);
      }
      
      // CPU: Convert nanoseconds to percentage
      // For display purposes, normalize to 0-100% range
      // This represents CPU usage as a percentage of total fleet capacity
      // (approximating 1 CPU-second per real second as 100%)
      cpuPercent = Math.min(100, Math.round(totalCpuUsage / 10000000)); // scale for display
    }

    const fleetMetrics: FleetMetricsPoint[] = [{
      time: timeStr,
      cpu: cpuPercent,
      memory: memPercent,
    }];

    return new Response(JSON.stringify(fleetMetrics), { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to fetch fleet metrics', details: error.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/fleet-metrics',
};
