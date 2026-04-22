export interface ScanQuotaDisplayInput {
  plan: string | null | undefined;
  limit: number | null | undefined;
  used?: number | null | undefined;
  remaining?: number | null | undefined;
  resetAt?: string | null | undefined;
}

export const SCAN_REFRESH_COSTS = {
  dashboard: 2,
  containers: 3,
  host: 2,
  containerDetail: 1,
} as const;

export function isManualScanPlan(plan: string | null | undefined, limit?: number | null) {
  if (typeof limit === "number") {
    return true;
  }

  return (plan || "").trim().toLowerCase() === "free";
}

export function isScanQuotaExhausted(limit?: number | null, remaining?: number | null) {
  return typeof limit === "number" && typeof remaining === "number" && remaining <= 0;
}

export function formatScanQuotaResetDate(resetAt: string | null | undefined) {
  if (!resetAt) {
    return null;
  }

  const parsed = new Date(resetAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatScanQuotaSummary({
  plan,
  limit,
  used,
  remaining,
  resetAt,
}: ScanQuotaDisplayInput) {
  if (!isManualScanPlan(plan, limit)) {
    return null;
  }

  const safeUsed = Math.max(0, used ?? 0);
  const safeRemaining = typeof remaining === "number" ? Math.max(0, remaining) : null;
  const resetLabel = formatScanQuotaResetDate(resetAt);

  if (typeof limit === "number") {
    const parts = [
      `${safeUsed} / ${limit} used`,
      `${safeRemaining ?? Math.max(0, limit - safeUsed)} left`,
    ];

    if (resetLabel) {
      parts.push(`resets ${resetLabel}`);
    }

    return parts.join(" · ");
  }

  if (safeRemaining !== null) {
    const parts = [`${safeRemaining} scans left`];

    if (resetLabel) {
      parts.push(`resets ${resetLabel}`);
    }

    return parts.join(" · ");
  }

  return "Manual refresh required on this plan.";
}

export function formatScanRefreshCost(scanCost?: number | null) {
  if (!scanCost || scanCost <= 0) {
    return null;
  }

  return `This refresh uses ${scanCost} scan${scanCost === 1 ? "" : "s"}.`;
}
