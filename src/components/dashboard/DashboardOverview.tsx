import { PageHeader } from "@/components/shared/PageHeader";
import { KPICard } from "@/components/shared/KPICard";
import { HostHealthGrid } from "@/components/dashboard/HostHealthGrid";
import { FleetResourceChart } from "@/components/dashboard/FleetResourceChart";
import { ContainersTable } from "@/components/dashboard/ContainersTable";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { Activity, AlertCircle, Box, Server } from "lucide-react";
import type { DockerHost } from "@/types/database";
import type { DashboardStats } from "@/lib/dashboard-summary";

interface DashboardOverviewProps {
  organizationName?: string;
  organizationId: string | null;
  hosts: DockerHost[];
  stats: DashboardStats;
  rawStats: unknown;
  containersLoading: boolean;
  isFetching?: boolean;
  liveDataError?: string | null;
  fleetMetricsRefetchInterval?: number | false;
}

export function DashboardOverview({
  organizationName,
  organizationId,
  hosts,
  stats,
  rawStats,
  containersLoading,
  isFetching,
  liveDataError,
  fleetMetricsRefetchInterval = 10000,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-10">
      <div className="px-0">
        <PageHeader
          title="Dashboard"
          description={organizationName || "Overview"}
          breadcrumbs={[{ label: "Operations" }, { label: "Fleet Summary" }]}
        />
      </div>

      {liveDataError ? (
        <div className="px-0">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs sm:text-sm text-destructive">
            {liveDataError}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <KPICard label="Total Hosts" value={stats.hostsCount} subtext="Connected infra" icon={Server} status={stats.hostsCount > 0 ? "success" : "neutral"} />
        <KPICard label="Connected" value={stats.connectedCount} subtext="Active & healthy" status={stats.connectedCount === stats.hostsCount ? "success" : "warning"} trend={{ value: "Stable", type: "neutral" }} />
        <KPICard label="Unhealthy" value={stats.unhealthyCount} subtext="Critical attention" status={stats.unhealthyCount > 0 ? "destructive" : "success"} />
        <KPICard label="Containers" value={stats.containersCount} subtext="Total workloads" icon={Box} status="neutral" />
        <KPICard label="Running" value={stats.runningCount} subtext="Productive tasks" icon={Activity} status="success" />
        <KPICard label="Issues" value={stats.alerts.length} subtext="Active alerts" icon={AlertCircle} status={stats.alerts.length > 0 ? "destructive" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1 min-h-[280px] sm:min-h-[350px]">
          <HostHealthGrid hosts={hosts} />
        </div>
        <div className="lg:col-span-2 min-h-[280px] sm:min-h-[350px]">
          <FleetResourceChart orgId={organizationId} refetchInterval={fleetMetricsRefetchInterval} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="lg:col-span-3 min-h-[350px] sm:min-h-[450px]">
          <ContainersTable containers={stats.containers} rawStats={rawStats} isLoading={containersLoading} isFetching={isFetching} />
        </div>
        <div className="lg:col-span-1 min-h-[350px] sm:min-h-[450px]">
          <DashboardAlerts alerts={stats.alerts} />
        </div>
      </div>
    </div>
  );
}
