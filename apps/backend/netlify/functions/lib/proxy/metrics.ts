import { buildAgentRequest, dockerFetch } from './client';
import { toFiniteNumber, normalizeOptionalRate, normalizeDiskMetric } from './utils';
import { trimDiagnostic } from './errors';
import { formatDiagnosticDetail, parseDiagnosticPayload } from '../../../../../../shared/lib/diagnostics';
import type { Host, HostSecrets } from './types';

export function createHostMetricsPoint(data: any) {
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

export async function fetchAgentVersionReport(
  host: Host,
  secrets: HostSecrets | null,
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
