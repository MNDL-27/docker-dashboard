import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  formatScanQuotaResetDate,
  formatScanQuotaSummary,
  formatScanRefreshCost,
  isManualScanPlan,
  isScanQuotaExhausted,
} from "@/lib/scan-quota";
import { cn } from "@/lib/utils";

interface ScanQuotaStatusStripProps {
  plan: string | null | undefined;
  limit: number | null | undefined;
  used?: number | null | undefined;
  remaining?: number | null | undefined;
  resetAt?: string | null | undefined;
  scanCost?: number | null | undefined;
  className?: string;
}

export function ScanQuotaStatusStrip({
  plan,
  limit,
  used,
  remaining,
  resetAt,
  scanCost,
  className,
}: ScanQuotaStatusStripProps) {
  if (!isManualScanPlan(plan, limit)) {
    return null;
  }

  const exhausted = isScanQuotaExhausted(limit, remaining);
  const summary = formatScanQuotaSummary({ plan, limit, used, remaining, resetAt });
  const refreshCost = exhausted ? null : formatScanRefreshCost(scanCost);
  const resetLabel = formatScanQuotaResetDate(resetAt);

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        exhausted ? "border-warning/40 bg-warning/10" : "border-white/10 bg-background/35",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 rounded-full border p-2",
            exhausted ? "border-warning/30 bg-warning/10 text-warning" : "border-white/10 bg-background/45 text-muted-foreground",
          )}
        >
          {exhausted ? <AlertTriangle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{exhausted ? "Monthly scan limit reached" : "Manual live refresh"}</p>
          {summary ? <p className="mt-1 text-muted-foreground">{summary}</p> : null}
          {exhausted ? (
            <p className="mt-2 text-warning">
              You've used all fresh scans for this UTC month. Live refresh unlocks again{" "}
              {resetLabel ? `on ${resetLabel}.` : "at the next monthly reset."}
            </p>
          ) : (
            <>
              <p className="mt-2 text-muted-foreground">Automatic live refresh is disabled on this plan.</p>
              {refreshCost ? <p className="mt-1 text-muted-foreground">{refreshCost}</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
