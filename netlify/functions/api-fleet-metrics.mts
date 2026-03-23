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

async function fetchHostMetrics(hostUrl: string, apiKey: string, timeoutMs = 5000): Promise<{ cpu_time_ns: number; system_time_ns: number; online_cpus: number; memory_used: number; memory_limit: number } | null> {
  try {
    const response = await fetch(`${hostUrl.replace(/\/$/, '')}/metrics`, {
      headers: {
        'X-Agent-Key': apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Agent returns: cpu_time_ns, system_time_ns, online_cpus, memory_used, memory_limit
    return { 
      cpu_time_ns: data.cpu_time_ns || 0,
      system_time_ns: data.system_time_ns || 0,
      online_cpus: data.online_cpus || 1,
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

    // Aggregate: use Docker's standard formula
    // Docker Unix formula: (cpuDelta / systemDelta) * onlineCPUs * 100
    // This gives CPU % where 100% = 1 core fully used
    // For fleet: sum all host contributions
    let totalCpuTimeNs = 0;       // container CPU delta (sum across hosts)
    let totalSystemTimeNs = 0;   // system CPU time delta (sum across hosts)
    let totalOnlineCpus = 0;     // sum of online CPUs across hosts
    let totalMemoryUsed = 0;      // bytes
    let totalMemoryLimit = 0;     // bytes
    let hostCount = 0;

    results.forEach((result) => {
      if (result && result.system_time_ns > 0) {
        // Docker formula per host: (cpu_time / system_time) * online_cpus
        // Sum across hosts for fleet total
        const hostCpuPercent = (result.cpu_time_ns / result.system_time_ns) * result.online_cpus;
        totalCpuTimeNs += hostCpuPercent;  // This is now percentage units, not ns
        totalSystemTimeNs += result.system_time_ns;
        totalOnlineCpus += result.online_cpus;
        totalMemoryUsed += result.memory_used;
        totalMemoryLimit += result.memory_limit;
        hostCount++;
      }
    });

    // Compute percentages
    // CPU: Using Docker's formula - may exceed 100% on multi-core systems
    // This represents total fleet CPU usage where 100% = 1 core per host
    // Memory: fleet % = total_used / total_limit * 100
    let cpuPercent = 0;
    let memPercent = 0;
    
    if (hostCount > 0) {
      // Memory: true fleet-wide percentage
      if (totalMemoryLimit > 0) {
        memPercent = Math.round((totalMemoryUsed / totalMemoryLimit) * 100);
      }
      
      // CPU: Already computed as percentage units in aggregation
      // This matches Docker's (cpuDelta/systemDelta)*onlineCpus*100
      // Value represents aggregate CPU cores used across fleet
      // Note: May exceed 100% on multi-core systems - this is correct per Docker semantics
      cpuPercent = Math.round(totalCpuTimeNs);
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
