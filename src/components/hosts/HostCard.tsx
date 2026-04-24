import { Lock, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { getHostStatusAppearance } from "@/lib/host-health-state";
import type { DockerHost } from "@/types/database";
import type { HostMetricsPoint } from "@/hooks/useHostMetrics";

export function HostCard({
  host,
  selected,
  previewMetrics,
  onSelect,
  isLocked,
}: {
  host: DockerHost;
  selected: boolean;
  previewMetrics?: Pick<HostMetricsPoint, "cpu" | "memory"> | null;
  onSelect: () => void;
  isLocked?: boolean;
}) {
  const statusAppearance = getHostStatusAppearance(host.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-all",
        isLocked
          ? "border-white/5 bg-background/20 opacity-60 hover:opacity-80 hover:border-warning/30"
          : selected
            ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px_rgba(34,197,94,0.15)]"
            : "border-white/5 bg-background/40 hover:border-primary/20 hover:bg-background/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight">{host.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {host.connection_mode === "cloudflare_tunnel" ? "Cloudflare tunnel" : "Agent"}
          </p>
        </div>
        {isLocked ? (
          <Lock className="mt-1 h-4 w-4 shrink-0 text-warning" />
        ) : (
          <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", statusAppearance.dotClassName)} />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        {isLocked ? (
          <span className="text-xs text-warning">Upgrade to access</span>
        ) : (
          <>
            <span>CPU: {previewMetrics ? `${previewMetrics.cpu.toFixed(0)}%` : "--"}</span>
            <span>RAM: {previewMetrics ? `${previewMetrics.memory.toFixed(0)}%` : "--"}</span>
          </>
        )}
      </div>
    </button>
  );
}
