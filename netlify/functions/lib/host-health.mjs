export const DEFAULT_STALE_THRESHOLD_MINUTES = 5;
export const DEFAULT_UNHEALTHY_THRESHOLD = 3;

export function parseStaleThresholdMinutes(rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STALE_THRESHOLD_MINUTES;
  return Math.floor(n);
}

export function staleCutoffDate(now = new Date(), staleThresholdMinutes = DEFAULT_STALE_THRESHOLD_MINUTES) {
  return new Date(now.getTime() - staleThresholdMinutes * 60_000);
}

export function shouldMarkHostStale(host, now = new Date(), staleThresholdMinutes = DEFAULT_STALE_THRESHOLD_MINUTES) {
  if (!host) return false;
  if (host.status !== 'connected') return false;
  if (!host.last_seen_at) return false;

  const seenAt = new Date(host.last_seen_at);
  if (Number.isNaN(seenAt.getTime())) return false;

  return seenAt < staleCutoffDate(now, staleThresholdMinutes);
}

export function failureStatusForCount(failureCount, unhealthyThreshold = DEFAULT_UNHEALTHY_THRESHOLD) {
  return failureCount >= unhealthyThreshold ? 'unhealthy' : 'error';
}
