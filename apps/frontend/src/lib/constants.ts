/**
 * Shared polling and UI timing constants.
 *
 * Centralizes magic numbers that were previously hardcoded across
 * hooks and components, making intervals easy to tune in one place.
 */

// ── Polling / Refetch Intervals ──

/** Fast poll for live metrics (CPU, memory, network). */
export const FAST_POLL_INTERVAL_MS = 10_000;

/** Medium poll for container lists and stats. */
export const MEDIUM_POLL_INTERVAL_MS = 15_000;

/** Slow poll for alerts, notifications, and fleet overview. */
export const SLOW_POLL_INTERVAL_MS = 30_000;

/** Minute-level heartbeat (app update checks, page view tracking). */
export const MINUTE_POLL_INTERVAL_MS = 60_000;

// ── UI Timing ──

/** Duration the "Copied to clipboard" feedback is shown. */
export const COPY_FEEDBACK_DURATION_MS = 1_500;

/** Toast notification auto-dismiss duration. */
export const TOAST_DURATION_MS = 5_000;

// ── Data Limits ──

/** Default maximum data points kept in metrics history charts. */
export const DEFAULT_MAX_DATA_POINTS = 24;

// ── Time-Unit Conversions ──

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
