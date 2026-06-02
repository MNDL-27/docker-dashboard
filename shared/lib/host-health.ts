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

/**
 * Standardizes host status strings to a known set of keys.
 */
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

/**
 * Logic to determine if a host should be transitioned from 'connected' to 'stale'.
 */
export function shouldMarkHostStale(
  host: { status?: string; last_seen_at?: string | null } | null | undefined,
  now: Date = new Date(),
  staleThresholdMinutes: number = DEFAULT_STALE_THRESHOLD_MINUTES,
): boolean {
  if (!host) return false;
  if (host.status !== "connected") return false;
  if (!host.last_seen_at) return false;

  const seenAt = new Date(host.last_seen_at);
  if (Number.isNaN(seenAt.getTime())) return false;

  const cutoff = new Date(now.getTime() - staleThresholdMinutes * 60_000);
  return seenAt < cutoff;
}

/**
 * Helper to determine the severity status based on failure count.
 */
export function failureStatusForCount(failureCount: number, unhealthyThreshold: number = DEFAULT_UNHEALTHY_THRESHOLD): "error" | "unhealthy" {
  return failureCount >= unhealthyThreshold ? "unhealthy" : "error";
}

/**
 * Utility to parse threshold minutes with a safe fallback.
 */
export function parseStaleThresholdMinutes(rawValue: unknown): number {
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STALE_THRESHOLD_MINUTES;
  return Math.floor(n);
}
