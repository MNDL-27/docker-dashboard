export const DEFAULT_STALE_THRESHOLD_MINUTES = 5;
export const DEFAULT_UNHEALTHY_THRESHOLD = 3;

export type NormalizedHostStatus =
  | "connected"
  | "stale"
  | "error"
  | "unhealthy"
  | "down"
  | "disconnected"
  | "unknown";

export function normalizeHostStatus(status: string | null | undefined): NormalizedHostStatus {
  const normalized = String(status || "").toLowerCase();

  switch (normalized) {
    case "connected":
    case "stale":
    case "error":
    case "unhealthy":
    case "down":
    case "disconnected":
      return normalized;
    default:
      return "unknown";
  }
}

export function isReadableHostStatus(status: string | null | undefined): boolean {
  const normalizedStatus = normalizeHostStatus(status);
  return normalizedStatus === "connected" || normalizedStatus === "stale";
}

export function isUnhealthyHostStatus(status: string | null | undefined): boolean {
  const normalizedStatus = normalizeHostStatus(status);
  return ["error", "disconnected", "down", "stale", "unhealthy"].includes(normalizedStatus);
}

export function getHostStatusAppearance(status: string | null | undefined): {
  pillClassName: string;
  dotClassName: string;
  isOnlineIcon: boolean;
} {
  const normalizedStatus = normalizeHostStatus(status);

  switch (normalizedStatus) {
    case "connected":
      return {
        pillClassName: "bg-success/15 text-success border-success/20",
        dotClassName: "bg-success shadow-[0_0_16px_rgba(34,197,94,0.6)]",
        isOnlineIcon: true,
      };
    case "unhealthy":
    case "down":
    case "disconnected":
      return {
        pillClassName: "bg-destructive/15 text-destructive border-destructive/20",
        dotClassName: "bg-destructive shadow-[0_0_16px_rgba(239,68,68,0.45)]",
        isOnlineIcon: false,
      };
    case "stale":
    case "error":
      return {
        pillClassName: "bg-warning/15 text-warning border-warning/20",
        dotClassName: "bg-warning shadow-[0_0_16px_rgba(245,158,11,0.45)]",
        isOnlineIcon: false,
      };
    default:
      return {
        pillClassName: "bg-muted text-muted-foreground border-border",
        dotClassName: "bg-muted-foreground/40",
        isOnlineIcon: false,
      };
  }
}

export function getHostAlertCopy(status: string | null | undefined, hostName: string): {
  title: string;
  description: string;
} {
  const normalizedStatus = normalizeHostStatus(status);

  switch (normalizedStatus) {
    case "stale":
      return {
        title: "Host Heartbeat Stale",
        description: `Host "${hostName}" has not checked in recently. Metrics may be delayed until the next successful heartbeat.`,
      };
    case "unhealthy":
      return {
        title: "Host Unhealthy",
        description: `Host "${hostName}" is failing health checks repeatedly. Investigate the agent and host connectivity.`,
      };
    case "down":
      return {
        title: "Host Down",
        description: `Host "${hostName}" appears offline. Check power, network reachability, and the local agent service.`,
      };
    case "disconnected":
      return {
        title: "Host Disconnected",
        description: `Host "${hostName}" is disconnected from the dashboard. Check tunnel or agent connectivity.`,
      };
    case "error":
      return {
        title: "Host Error",
        description: `Host "${hostName}" returned an error during health checks. Review agent logs and connectivity.`,
      };
    default:
      return {
        title: "Host Alert",
        description: `Host "${hostName}" needs attention. Review connectivity and agent health.`,
      };
  }
}

export function parseStaleThresholdMinutes(rawValue: unknown): number {
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STALE_THRESHOLD_MINUTES;
  return Math.floor(n);
}

export function shouldMarkHostStale(
  host: { status?: string; last_seen_at?: string | null } | null | undefined,
  now: Date,
  staleThresholdMinutes: number,
): boolean {
  if (!host) return false;
  if (host.status !== "connected") return false;
  if (!host.last_seen_at) return false;

  const seenAt = new Date(host.last_seen_at);
  if (Number.isNaN(seenAt.getTime())) return false;

  const cutoff = new Date(now.getTime() - staleThresholdMinutes * 60_000);
  return seenAt < cutoff;
}

export function failureStatusForCount(failureCount: number, unhealthyThreshold: number): "error" | "unhealthy" {
  return failureCount >= unhealthyThreshold ? "unhealthy" : "error";
}
