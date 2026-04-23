import { Activity, CalendarClock, Gauge, Layers3 } from "lucide-react";

import { PLAN_POLICY_BY_PLAN } from "../../../shared/schema/plan-policy";

import {
  formatScanQuotaResetDate,
  formatScanQuotaSummary,
  isManualScanPlan,
} from "@/lib/scan-quota";
import { getPricingPlan } from "@/lib/pricing";

function formatPlanName(plan: string | null | undefined) {
  if (!plan) {
    return "Not set";
  }

  if (plan === "free" || plan === "pro" || plan === "team" || plan === "enterprise") {
    return getPricingPlan(plan)?.name ?? plan;
  }

  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

function UsageMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

interface ScanQuotaUsageCardProps {
  plan: string | null | undefined;
  limit: number | null | undefined;
  used?: number | null | undefined;
  remaining?: number | null | undefined;
  resetAt?: string | null | undefined;
}

export function ScanQuotaUsageCard({
  plan,
  limit,
  used,
  remaining,
  resetAt,
}: ScanQuotaUsageCardProps) {
  const manualPlan = isManualScanPlan(plan, limit);
  const summary = formatScanQuotaSummary({ plan, limit, used, remaining, resetAt });
  const resetLabel = formatScanQuotaResetDate(resetAt);
  const safeUsed = Math.max(0, used ?? 0);

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Current cycle usage</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Scan quota</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A scan is a fresh live data request from the dashboard, containers, host, or container detail views.
            Logs, container actions, and background health checks do not count.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-white/10 bg-background/35 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {manualPlan ? "Manual refresh plan" : "Unlimited live refresh"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UsageMetric label="Effective plan" value={formatPlanName(plan)} icon={Layers3} />
        <UsageMetric
          label="Current cycle"
          value={manualPlan ? `${safeUsed} / ${limit ?? PLAN_POLICY_BY_PLAN.free.monthlyScanLimit} used` : "Unlimited live refresh"}
          icon={Gauge}
        />
        <UsageMetric
          label="Remaining"
          value={manualPlan ? `${remaining ?? 0} left` : "No monthly cap"}
          icon={Activity}
        />
        <UsageMetric
          label="Reset"
          value={manualPlan ? resetLabel ?? "Next UTC month" : "Not capped"}
          icon={CalendarClock}
        />
      </div>

      {summary ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
          {summary}
        </div>
      ) : null}
    </div>
  );
}
