import { ApiError } from "@/lib/api";

export interface HostMetricsPoint {
  timestamp: number;
  time: string;
  cpu: number | null;
  memory: number | null;
  usedCores: number | null;
  totalCores: number | null;
  memoryUsed: number | null;
  memoryLimit: number | null;
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

export interface HostMetricsApiPoint {
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
  used_cores?: number;
  total_cores?: number;
  memory_used?: number;
  memory_limit?: number;
  disks?: unknown;
}

export interface HostMetricsApiDisk {
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
  if (value === null || value === "" || Array.isArray(value)) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
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

  if (!device || !mount || usedBytes === null || totalBytes === null || usedBytes < 0 || totalBytes <= 0) {
    return null;
  }

  return {
    device,
    mount,
    usedBytes,
    totalBytes: Math.max(usedBytes, totalBytes),
    readBytesPerSec,
    writeBytesPerSec,
  };
}

export function transformApiMetrics(point: HostMetricsApiPoint): HostMetricsPoint {
  const timestamp = toTimestamp(point.timestamp) ?? Date.now();

  const cpuRaw = toFiniteNumber(point.cpu);
  const memoryRaw = toFiniteNumber(point.memory);
  const usedCoresRaw = toFiniteNumber(point.usedCores ?? point.used_cores);
  const totalCoresRaw = toFiniteNumber(point.totalCores ?? point.total_cores);
  const memoryUsedRaw = toFiniteNumber(point.memoryUsed ?? point.memory_used);
  const memoryLimitRaw = toFiniteNumber(point.memoryLimit ?? point.memory_limit);

  const cpu = cpuRaw !== null ? clamp(cpuRaw, 0, 100) : null;
  const memory = memoryRaw !== null ? clamp(memoryRaw, 0, 100) : null;
  const totalCores = totalCoresRaw !== null ? Math.max(0, totalCoresRaw) : null;
  const usedCores = usedCoresRaw !== null ? clamp(usedCoresRaw, 0, totalCores ?? usedCoresRaw) : null;
  const memoryLimit = memoryLimitRaw !== null ? Math.max(0, memoryLimitRaw) : null;
  const memoryUsed = memoryUsedRaw !== null ? clamp(memoryUsedRaw, 0, memoryLimit ?? memoryUsedRaw) : null;

  const networkInBytesPerSec = normalizeOptionalRate(point.networkInBytesPerSec ?? point.network_in_bytes_per_sec);
  const networkOutBytesPerSec = normalizeOptionalRate(point.networkOutBytesPerSec ?? point.network_out_bytes_per_sec);
  const networkMonthlyTotal = toFiniteNumber(point.networkMonthlyTotal ?? point.network_monthly_total);
  const diskReadBytesPerSec = normalizeOptionalRate(point.diskReadBytesPerSec ?? point.disk_read_bytes_per_sec);
  const diskWriteBytesPerSec = normalizeOptionalRate(point.diskWriteBytesPerSec ?? point.disk_write_bytes_per_sec);
  const uptimeSecondsRaw = toFiniteNumber(point.uptimeSeconds ?? point.uptime_seconds);
  const uptimeSeconds = uptimeSecondsRaw !== null && uptimeSecondsRaw >= 0 ? uptimeSecondsRaw : null;
  const disks = Array.isArray(point.disks) ? point.disks.map(normalizeHostMetricsDisk).filter((disk): disk is HostMetricsDisk => disk !== null) : [];

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

export function isMetricsSampleValid(metrics: HostMetricsPoint): boolean {
  return metrics.cpu !== null && metrics.memory !== null;
}

export function getHostMetricsFailure(error: unknown): HostMetricsFailure | null {
  if (!error) return null;

  if (error instanceof ApiError) {
    const details = error.details;
    let detailText: string | null = null;
    if (typeof details === "string") detailText = details;
    else if (details && typeof details === "object") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detailText = (details as any).error || JSON.stringify(details);
    }
    
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
