export const DEFAULT_STALE_THRESHOLD_MINUTES = 5;
export const DEFAULT_UNHEALTHY_THRESHOLD = 3;

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
