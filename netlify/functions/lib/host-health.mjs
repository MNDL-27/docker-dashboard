import { 
  DEFAULT_STALE_THRESHOLD_MINUTES,
  DEFAULT_UNHEALTHY_THRESHOLD,
  parseStaleThresholdMinutes,
  shouldMarkHostStale,
  failureStatusForCount
} from "../../../shared/lib/host-health";

export { 
  DEFAULT_STALE_THRESHOLD_MINUTES,
  DEFAULT_UNHEALTHY_THRESHOLD,
  parseStaleThresholdMinutes,
  shouldMarkHostStale,
  failureStatusForCount
};

/**
 * Cutoff date for stale heartbeats.
 */
export function staleCutoffDate(now = new Date(), staleThresholdMinutes = DEFAULT_STALE_THRESHOLD_MINUTES) {
  return new Date(now.getTime() - staleThresholdMinutes * 60_000);
}
