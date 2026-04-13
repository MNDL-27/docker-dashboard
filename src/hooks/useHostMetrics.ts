import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";

export interface HostMetricsPoint {
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

interface HostMetricsApiPoint {
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
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function formatTimeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeOptionalRate(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) return null;
  return numeric;
}

export function normalizeHostMetricsPoint(point: HostMetricsApiPoint): HostMetricsPoint | null {
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

  if (totalCores === 0 && memoryLimit === 0) return null;
  if ((cpu > 0 && totalCores === 0) || (memory > 0 && memoryLimit === 0)) return null;

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

interface UseHostMetricsOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useHostMetrics(hostId?: string | null, options: UseHostMetricsOptions = {}) {
  const { enabled = true, refetchInterval = 10000 } = options;

  return useQuery({
    queryKey: ["host-metrics", hostId],
    queryFn: async (): Promise<HostMetricsPoint> => {
      const data = await dockerApi.hostMetrics(hostId!);
      const normalized = normalizeHostMetricsPoint((data ?? {}) as HostMetricsApiPoint);
      if (!normalized) throw new Error("Host metrics unavailable");
      return normalized;
    },
    enabled: enabled && !!hostId,
    refetchInterval: enabled ? refetchInterval : false,
  });
}

interface UseHostMetricsHistoryOptions extends UseHostMetricsOptions {
  maxDataPoints?: number;
}

export function useHostMetricsHistory(hostId?: string | null, options: UseHostMetricsHistoryOptions = {}) {
  const { maxDataPoints = 24, enabled = true, refetchInterval = 10000 } = options;
  const [history, setHistory] = useState<HostMetricsPoint[]>([]);
  const query = useHostMetrics(hostId, { enabled, refetchInterval });

  useEffect(() => {
    setHistory([]);
  }, [hostId]);

  useEffect(() => {
    if (!query.data) return;

    setHistory((previous) => {
      const withoutDuplicate = previous.filter((point) => point.timestamp !== query.data!.timestamp);
      return [...withoutDuplicate, query.data!]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxDataPoints);
    });
  }, [maxDataPoints, query.data]);

  return {
    ...query,
    history,
    latestPoint: history[history.length - 1] ?? query.data,
  };
}
