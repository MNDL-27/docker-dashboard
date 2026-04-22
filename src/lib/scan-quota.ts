export function isManualScanPlan(plan: string | null | undefined, limit?: number | null) {
  if (typeof limit === "number") {
    return true;
  }

  return (plan || "").trim().toLowerCase() === "free";
}

export function formatScanQuotaSummary({
  plan,
  limit,
  remaining,
}: {
  plan: string | null | undefined;
  limit: number | null | undefined;
  remaining: number | null | undefined;
}) {
  if (!isManualScanPlan(plan, limit)) {
    return null;
  }

  if (typeof limit === "number" && typeof remaining === "number") {
    return `${remaining} of ${limit} fresh scans remaining this month.`;
  }

  if (typeof limit === "number") {
    return `${limit} fresh scans per month on the Free plan.`;
  }

  return "Free plan live data uses manual refreshes.";
}
