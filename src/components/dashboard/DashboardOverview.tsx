import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/dashboard/KPICard";
import { HostHealthGrid } from "@/components/dashboard/HostHealthGrid";
import { FleetResourceChart } from "@/components/dashboard/FleetResourceChart";
import { ContainersTable } from "@/components/dashboard/ContainersTable";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { ScanQuotaStatusStrip } from "@/components/shared/ScanQuotaStatusStrip";
import { Button } from "@/components/ui/button";
import { SCAN_REFRESH_COSTS } from "@/lib/scan-quota";
import { Activity, AlertCircle, Box, Loader2, RefreshCw, Server } from "lucide-react";
import type { DockerHost } from "@/types/database";
import type { DashboardStats } from "@/lib/dashboard-summary";

interface DashboardOverviewProps {
  organizationName?: string;
  organizationId: string | null;
  hosts: DockerHost[];
  stats: DashboardStats;
  containersLoading: boolean;
  liveDataError?: string | null;
  scanQuotaPlan?: string | null;
  scanQuotaLimit?: number | null;
  scanQuotaUsed?: number | null;
  scanQuotaRemaining?: number | null;
  scanQuotaResetAt?: string | null;
  scanQuotaExhausted?: boolean;
  manualScanMode?: boolean;
  isRefreshingLiveData?: boolean;
  fleetMetricsRefetchInterval?: number | false;
  onRefreshLiveData?: () => void | Promise<void>;
}

export function DashboardOverview({
  organizationName,
  organizationId,
  hosts,
  stats,
  containersLoading,
  liveDataError,
  scanQuotaPlan,
  scanQuotaLimit,
  scanQuotaUsed,
  scanQuotaRemaining,
  scanQuotaResetAt,
  scanQuotaExhausted = false,
  manualScanMode = false,
  isRefreshingLiveData = false,
  fleetMetricsRefetchInterval = 10000,
  onRefreshLiveData,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="p-6 pb-0">
        <PageHeader
          title="Dashboard"
          description={organizationName || "Overview"}
          breadcrumbs={[{ label: "Operations" }, { label: "Fleet Summary" }]}
          actions={
            manualScanMode && onRefreshLiveData ? (
              <Button variant="outline" className="gap-2" onClick={() => void onRefreshLiveData()} disabled={isRefreshingLiveData || scanQuotaExhausted}>
                {isRefreshingLiveData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh Live Data
              </Button>
            ) : null
          }
        />
      </div>

      {manualScanMode ? (
        <div className="px-6">
          <ScanQuotaStatusStrip
            plan={scanQuotaPlan}
            limit={scanQuotaLimit}
            used={scanQuotaUsed}
            remaining={scanQuotaRemaining}
            resetAt={scanQuotaResetAt}
            scanCost={SCAN_REFRESH_COSTS.dashboard}
          />
        </div>
      ) : null}

      {liveDataError ? (
        <div className="px-6">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {liveDataError}
          </div>
        </div>
      ) : null}

      <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Hosts" value={stats.hostsCount} subtext="Connected infra" icon={Server} status={stats.hostsCount > 0 ? "success" : "neutral"} />
        <KPICard label="Connected" value={stats.connectedCount} subtext="Active & healthy" status={stats.connectedCount === stats.hostsCount ? "success" : "warning"} trend={{ value: "Stable", type: "neutral" }} />
        <KPICard label="Unhealthy" value={stats.unhealthyCount} subtext="Critical attention" status={stats.unhealthyCount > 0 ? "destructive" : "success"} />
        <KPICard label="Containers" value={stats.containersCount} subtext="Total workloads" icon={Box} status="neutral" />
        <KPICard label="Running" value={stats.runningCount} subtext="Productive tasks" icon={Activity} status="success" />
        <KPICard label="Issues" value={stats.alerts.length} subtext="Active alerts" icon={AlertCircle} status={stats.alerts.length > 0 ? "destructive" : "success"} />
      </div>

      <div className="px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-[350px]">
          <HostHealthGrid hosts={hosts} />
        </div>
        <div className="lg:col-span-2 h-[350px]">
          <FleetResourceChart orgId={organizationId} refetchInterval={fleetMetricsRefetchInterval} />
        </div>
      </div>

      <div className="px-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 min-h-[450px]">
          <ContainersTable containers={stats.containers} isLoading={containersLoading} />
        </div>
        <div className="lg:col-span-1 min-h-[450px]">
          <DashboardAlerts alerts={stats.alerts} />
        </div>
      </div>
    </div>
  );
}

