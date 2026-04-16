import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { ApiError } from "@/lib/api";

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
  networkMonthlyTotal: number | null;
  diskReadBytesPerSec: number | null;
  diskWriteBytesPerSec: number | null;
  uptimeSeconds: number | null;
  disks: HostMetricsDisk[];
}

export interface HostMetricsDisk {
  device: string;
  mount: string;
  usedBytes: number;
  totalBytes: number;
  readBytesPerSec: number | null;
  writeBytesPerSec: number | null;
}

export interface HostMetricsFailure {
  message: string;
  code?: string;
  details?: unknown;
  status?: number;
  upstreamStatus?: number;
  unsupportedEndpoint: boolean;
  malformedPayload: boolean;
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
  networkMonthlyTotal?: number;
  network_monthly_total?: number;
  uptimeSeconds?: number;
  uptime_seconds?: number;
  disks?: unknown;
}

interface HostMetricsApiDisk {
  device?: string;
  mount?: string;
  usedBytes?: number;
  totalBytes?: number;
  readBytesPerSec?: number;
  writeBytesPerSec?: number;
  used_bytes?: number;
  total_bytes?: number;
  read_bytes_per_sec?: number;
  write_bytes_per_sec?: number;
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

function normalizeHostMetricsDisk(value: unknown): HostMetricsDisk | null {
  if (!value || typeof value !== "object") return null;

  const disk = value as HostMetricsApiDisk;
  const device = typeof disk.device === "string" ? disk.device.trim() : "";
  const mount = typeof disk.mount === "string" ? disk.mount.trim() : "";
  const usedBytes = toFiniteNumber(disk.usedBytes ?? disk.used_bytes);
  const totalBytes = toFiniteNumber(disk.totalBytes ?? disk.total_bytes);
  const readBytesPerSec = normalizeOptionalRate(disk.readBytesPerSec ?? disk.read_bytes_per_sec);
  const writeBytesPerSec = normalizeOptionalRate(disk.writeBytesPerSec ?? disk.write_bytes_per_sec);

  if (!device || !mount || usedBytes === null || totalBytes === null || usedBytes < 0 || totalBytes <= 0 || usedBytes > totalBytes) {
    return null;
  }

  return {
    device,
    mount,
    usedBytes,
    totalBytes,
    readBytesPerSec,
    writeBytesPerSec,
  };
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
  const networkMonthlyTotal = toFiniteNumber(point.networkMonthlyTotal ?? point.network_monthly_total);
  const diskReadBytesPerSec = normalizeOptionalRate(point.diskReadBytesPerSec ?? point.disk_read_bytes_per_sec);
  const diskWriteBytesPerSec = normalizeOptionalRate(point.diskWriteBytesPerSec ?? point.disk_write_bytes_per_sec);
  const uptimeSecondsRaw = toFiniteNumber(point.uptimeSeconds ?? point.uptime_seconds);
  const uptimeSeconds = uptimeSecondsRaw !== null && uptimeSecondsRaw >= 0 ? uptimeSecondsRaw : null;
  const disks = Array.isArray(point.disks) ? point.disks.map(normalizeHostMetricsDisk).filter((disk): disk is HostMetricsDisk => disk !== null) : [];

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

  if (totalCores === 0 && memoryLimit === 0) {
    if (cpu !== 0 || memory !== 0 || usedCores !== 0 || memoryUsed !== 0) {
      return null;
    }
  }
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
    networkMonthlyTotal,
    diskReadBytesPerSec,
    diskWriteBytesPerSec,
    uptimeSeconds,
    disks,
  };
}

function formatFailureDetails(details: unknown): string | null {
  if (details === null || details === undefined) return null;
  if (typeof details === "string") return details;
  if (typeof details === "object") {
    const error = typeof (details as { error?: unknown }).error === "string" ? (details as { error: string }).error : null;
    if (error) return error;
    try {
      return JSON.stringify(details);
    } catch {
      return null;
    }
  }
  return String(details);
}

export function getHostMetricsFailure(error: unknown): HostMetricsFailure | null {
  if (!error) return null;

  if (error instanceof ApiError) {
    const details = error.details;
    const detailText = formatFailureDetails(details);
    const message = detailText ? `${error.message}: ${detailText}` : error.message;
    return {
      message,
      code: error.code,
      details,
      status: error.status,
      upstreamStatus: error.upstreamStatus,
      unsupportedEndpoint:
        error.code === "metrics_endpoint_unsupported" ||
        error.status === 404 ||
        error.status === 405,
      malformedPayload: error.code === "malformed_metrics_payload",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      unsupportedEndpoint: false,
      malformedPayload: false,
    };
  }

  return {
    message: "Host metrics are temporarily unavailable.",
    unsupportedEndpoint: false,
    malformedPayload: false,
  };
}

interface UseHostMetricsOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useHostMetrics(hostId?: string | null, options: UseHostMetricsOptions = {}) {
  const { enabled = true, refetchInterval = 10000 } = options;

  const query = useQuery({
    queryKey: ["host-metrics", hostId],
    queryFn: async (): Promise<HostMetricsPoint> => {
      const data = await dockerApi.hostMetrics(hostId!);
      const normalized = normalizeHostMetricsPoint((data ?? {}) as HostMetricsApiPoint);
      if (!normalized) {
        throw new ApiError(
          502,
          {
            error: "Host metrics unavailable",
            code: "malformed_metrics_payload",
            details: "Agent returned a success response without a usable host metrics sample.",
          },
          "Host metrics unavailable",
        );
      }
      return normalized;
    },
    enabled: enabled && !!hostId,
    retry: false,
    refetchInterval: enabled ? refetchInterval : false,
  });

  return {
    ...query,
    failure: getHostMetricsFailure(query.error),
  };
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

  const latestPoint = history[history.length - 1] ?? query.data;
  const failure = useMemo(() => getHostMetricsFailure(query.error), [query.error]);

  return {
    ...query,
    history,
    latestPoint,
    failure,
  };
}
