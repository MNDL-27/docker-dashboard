import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FleetMetrics {
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
}

interface FleetMetricsApiPoint {
  timestamp?: string | number;
  time?: string;
  cpu?: number;
  memory?: number;
  usedCores?: number;
  totalCores?: number;
  memoryUsed?: number;
  memoryLimit?: number;
  networkInBytesPerSec?: number;
  networkOutBytesPerSec?: number;
  diskReadBytesPerSec?: number;
  diskWriteBytesPerSec?: number;
  network_in_bytes_per_sec?: number;
  network_out_bytes_per_sec?: number;
  disk_read_bytes_per_sec?: number;
  disk_write_bytes_per_sec?: number;
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatTimeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeOptionalRate(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) {
    return null;
  }

  return numeric;
}

function normalizeFleetMetricPoint(point: FleetMetricsApiPoint): FleetMetrics | null {
  const timestamp = toTimestamp(point.timestamp) ?? Date.now();

  const cpu = toFiniteNumber(point.cpu);
  const memory = toFiniteNumber(point.memory);
  const usedCores = toFiniteNumber(point.usedCores);
  const totalCores = toFiniteNumber(point.totalCores);
  const memoryUsed = toFiniteNumber(point.memoryUsed);
  const memoryLimit = toFiniteNumber(point.memoryLimit);
  const networkInBytesPerSec = normalizeOptionalRate(point.networkInBytesPerSec ?? point.network_in_bytes_per_sec);
  const networkOutBytesPerSec = normalizeOptionalRate(point.networkOutBytesPerSec ?? point.network_out_bytes_per_sec);
  const diskReadBytesPerSec = normalizeOptionalRate(point.diskReadBytesPerSec ?? point.disk_read_bytes_per_sec);
  const diskWriteBytesPerSec = normalizeOptionalRate(point.diskWriteBytesPerSec ?? point.disk_write_bytes_per_sec);

  if (
    cpu === null ||
    memory === null ||
    usedCores === null ||
    totalCores === null ||
    memoryUsed === null ||
    memoryLimit === null
  ) {
    return null;
  }

  if (
    cpu < 0 ||
    cpu > 100 ||
    memory < 0 ||
    memory > 100 ||
    usedCores < 0 ||
    totalCores < 0 ||
    memoryUsed < 0 ||
    memoryLimit < 0
  ) {
    return null;
  }

  // Reject points that have no usable absolute-capacity context.
  // This filters malformed "all zeros" samples while preserving legitimate 0% usage
  // when capacity is known (e.g. usedCores=0 with totalCores>0).
  if (totalCores === 0 && memoryLimit === 0) {
    return null;
  }

  // Inconsistent points: non-zero percentage without corresponding capacity.
  if ((cpu > 0 && totalCores === 0) || (memory > 0 && memoryLimit === 0)) {
    return null;
  }

  return {
    timestamp,
    time: formatTimeLabel(timestamp),
    cpu,
    memory,
    usedCores,
    totalCores,
    memoryUsed,
    memoryLimit,
    networkInBytesPerSec,
    networkOutBytesPerSec,
    diskReadBytesPerSec,
    diskWriteBytesPerSec,
  };
}

export function useFleetMetrics(orgId: string | null | undefined, refetchInterval = 10000) {
  return useQuery({
    queryKey: ['fleet-metrics', orgId],
    queryFn: async (): Promise<FleetMetrics[]> => {
      if (!orgId) {
        return [];
      }

      try {
        const data = await apiFetch('/fleet-metrics', {
          method: 'POST',
          body: JSON.stringify({ orgId }),
        });

        if (!Array.isArray(data)) {
          return [];
        }

        const normalized = data
          .map((point) => normalizeFleetMetricPoint((point ?? {}) as FleetMetricsApiPoint))
          .filter((point): point is FleetMetrics => point !== null);

        return normalized;
      } catch (error) {
        console.error('Failed to fetch fleet metrics:', error);
        return [];
      }
    },
    refetchInterval,
    enabled: !!orgId,
  });
}
