import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrganization } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Box,
  ChevronDown,
  Cpu,
  Loader2,
  MemoryStick,
  Play,
  RotateCw,
  Search,
  Server,
  Square,
} from "lucide-react";

import { SignalCard } from "@/components/dashboard/SignalCard";
import { KPICard } from "@/components/shared/KPICard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAllContainerStats, useContainers, useDockerHosts } from "@/hooks/useDocker";
import { useFleetMetrics } from "@/hooks/useFleetMetrics";
import { useViewerState } from "@/hooks/useViewerState";
import { dockerApi } from "@/services/docker-api";
import { cn, formatPercent, formatBytes } from "@/lib/utils";
import { PLAN_POLICY_BY_PLAN, normalizePlan } from "../../../shared/schema/plan-policy";

type BadgeStatus = "running" | "unhealthy" | "exited" | "restarting" | "paused" | "critical" | "warning";

interface ContainerListItem {
  Id: string;
  Names?: string[];
  Image?: string;
  State?: string;
  Status?: string;
  Created?: number;
  RestartCount?: number;
  HostConfig?: { RestartPolicy?: { MaximumRetryCount?: number } };
  _hostId?: string;
  _hostName?: string;
}

interface ContainerStatsItem {
  containerId: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  net_rx: number;
  net_tx: number;
}

const STATE_TABS = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "unhealthy", label: "Unhealthy" },
  { key: "restarting", label: "Restarting" },
  { key: "exited", label: "Exited" },
] as const;

function relativeAge(created?: number): string {
  if (!created) return "--";
  const seconds = Math.floor(Date.now() / 1000 - created);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function shortenImage(img: string): string {
  if (!img) return "--";
  const parts = img.split("/");
  return parts[parts.length - 1] || img;
}

function formatNetIO(rx: number, tx: number): string {
  return `${formatBytes(rx)} / ${formatBytes(tx)}`;
}

function mapState(state?: string, health?: string): BadgeStatus {
  if (health === "unhealthy") return "unhealthy";
  if (state === "running") return "running";
  if (state === "exited") return "exited";
  if (state === "restarting") return "restarting";
  if (state === "paused") return "paused";
  return "exited";
}

function severityBorderClass(state?: string, health?: string): string {
  if (health === "unhealthy") return "border-l-2 border-l-destructive/60";
  if (state === "restarting") return "border-l-2 border-l-warning/60";
  return "";
}

function metricTone(value: number | null): "success" | "warning" | "destructive" | "neutral" {
  if (value === null) return "neutral";
  if (value >= 90) return "destructive";
  if (value >= 80) return "warning";
  return "success";
}

function TelemetryBadge({
  loading,
  available,
  partial,
  autoRefresh,
}: {
  loading: boolean;
  available: boolean;
  partial: boolean;
  autoRefresh: boolean;
}) {
  const tone = loading
    ? "border-white/10 bg-background/50 text-muted-foreground"
    : !available
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : partial
        ? "border-warning/20 bg-warning/10 text-warning"
        : "border-success/20 bg-success/10 text-success";

  const label = loading
    ? "Updating telemetry"
    : !available
      ? "Telemetry unavailable"
      : !autoRefresh
        ? "Manual telemetry"
      : partial
        ? "Partial telemetry"
        : "Fleet telemetry live";

  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]", tone)}>{label}</span>;
}

export default function ContainersPage() {
  const queryClient = useQueryClient();
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;
  const {
    data: rawContainers,
    isLoading: containersLoading,
    isFetching: containersFetching,
    refetch: refetchContainers,
    error,
  } = useContainers(currentOrg?.id, hosts.length > 0, 30000);
  const {
    data: rawStats,
    isFetching: statsFetching,
    refetch: refetchStats,
    error: statsError,
  } = useAllContainerStats(currentOrg?.id, hosts.length > 0, 15000);
  const {
    data: fleetMetrics = [],
    isLoading: fleetMetricsLoading,
    isFetching: fleetMetricsFetching,
    refetch: refetchFleetMetrics,
    error: fleetMetricsError,
  } = useFleetMetrics(currentOrg?.id, 15000);

  const [search, setSearch] = useState("");
  const [stateTab, setStateTab] = useState("all");
  const [hostFilter, setHostFilter] = useState("");
  const [imageFilter, setImageFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const containers: ContainerListItem[] = useMemo(
    () => (Array.isArray(rawContainers) ? (rawContainers as ContainerListItem[]) : []),
    [rawContainers],
  );

  const uniqueHosts = useMemo(() => {
    const map = new Map<string, string>();
    containers.forEach((c) => {
      if (c._hostId && c._hostName) map.set(c._hostId, c._hostName);
    });
    return Array.from(map.entries());
  }, [containers]);

  const uniqueImages = useMemo(() => {
    const set = new Set<string>();
    containers.forEach((c) => c.Image && set.add(c.Image));
    return Array.from(set).sort();
  }, [containers]);

  const statsMap = useMemo(() => {
    const map = new Map<string, ContainerStatsItem>();
    if (Array.isArray(rawStats)) (rawStats as ContainerStatsItem[]).forEach((s) => map.set(s.containerId, s));
    return map;
  }, [rawStats]);

  const kpi = useMemo(() => {
    let running = 0;
    let unhealthy = 0;
    let restarting = 0;
    containers.forEach((c) => {
      if (c.State === "running") running++;
      const status = (c.Status || "").toLowerCase();
      if (status.includes("unhealthy") || c.State === "unhealthy") unhealthy++;
      if (c.State === "restarting") restarting++;
    });
    return { total: containers.length, running, unhealthy, restarting };
  }, [containers]);

  const latestFleetMetrics = useMemo(() => (fleetMetrics.length > 0 ? fleetMetrics[fleetMetrics.length - 1] : null), [fleetMetrics]);
  const hostCoverage = latestFleetMetrics ? `${latestFleetMetrics.reportingHosts}/${latestFleetMetrics.totalHosts}` : "--";

  const fleetCpuCard = useMemo(() => {
    if (fleetMetricsLoading) return { value: "--", helper: "Loading fleet telemetry...", status: "neutral" as const, progress: 0 };
    if (!latestFleetMetrics) return { value: "--", helper: "Fleet telemetry unavailable", status: "neutral" as const, progress: 0 };
    const coverage = latestFleetMetrics.reportingHosts === latestFleetMetrics.totalHosts
      ? `across ${latestFleetMetrics.totalHosts} host${latestFleetMetrics.totalHosts === 1 ? "" : "s"}`
      : `from ${latestFleetMetrics.reportingHosts} of ${latestFleetMetrics.totalHosts} hosts`;
    return {
      value: formatPercent(latestFleetMetrics.cpu),
      helper: `${latestFleetMetrics.usedCores.toFixed(2)} / ${latestFleetMetrics.totalCores.toFixed(2)} cores ${coverage}`.trim(),
      status: metricTone(latestFleetMetrics.cpu),
      progress: latestFleetMetrics.cpu,
    };
  }, [fleetMetricsLoading, latestFleetMetrics]);

  const fleetMemoryCard = useMemo(() => {
    if (fleetMetricsLoading) return { value: "--", helper: "Loading fleet telemetry...", status: "neutral" as const, progress: 0 };
    if (!latestFleetMetrics) return { value: "--", helper: "Fleet telemetry unavailable", status: "neutral" as const, progress: 0 };
    const coverage = latestFleetMetrics.reportingHosts === latestFleetMetrics.totalHosts
      ? `across ${latestFleetMetrics.totalHosts} host${latestFleetMetrics.totalHosts === 1 ? "" : "s"}`
      : `from ${latestFleetMetrics.reportingHosts} of ${latestFleetMetrics.totalHosts} hosts`;
    return {
      value: formatBytes(latestFleetMetrics.memoryUsed),
      helper: `${formatPercent(latestFleetMetrics.memory)} of ${formatBytes(latestFleetMetrics.memoryLimit)} ${coverage}`.trim(),
      status: metricTone(latestFleetMetrics.memory),
      progress: latestFleetMetrics.memory,
    };
  }, [fleetMetricsLoading, latestFleetMetrics]);

  const filtered = useMemo(() => {
    return containers.filter((c) => {
      const name = (c.Names?.[0] || "").replace(/^\//, "").toLowerCase();
      const image = (c.Image || "").toLowerCase();
      const hostName = (c._hostName || "").toLowerCase();
      const q = search.toLowerCase();
      if (q && !name.includes(q) && !image.includes(q) && !hostName.includes(q)) return false;
      if (stateTab === "unhealthy") {
        const status = (c.Status || "").toLowerCase();
        if (!status.includes("unhealthy") && c.State !== "unhealthy") return false;
      } else if (stateTab !== "all" && c.State !== stateTab) {
        return false;
      }
      if (hostFilter && c._hostId !== hostFilter) return false;
      if (imageFilter && c.Image !== imageFilter) return false;
      return true;
    });
  }, [containers, search, stateTab, hostFilter, imageFilter]);

  const hasActiveFilters = !!search || stateTab !== "all" || !!hostFilter || !!imageFilter;
  const activeHostLabel = uniqueHosts.find(([id]) => id === hostFilter)?.[1] || "";
  const telemetryAvailable = !!latestFleetMetrics;
  const telemetryPartial = latestFleetMetrics?.isPartial === true;
  const liveRefreshPending = containersFetching || statsFetching || fleetMetricsFetching;
  const auxiliaryErrorMessage = [statsError, fleetMetricsError]
    .map((queryError) => (queryError instanceof Error ? queryError.message : null))
    .filter((message): message is string => !!message)
    .join(" ");

  async function handleRefreshLiveData() {
    await Promise.allSettled([refetchContainers(), refetchStats(), refetchFleetMetrics()]);
    await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
  }

  async function handleAction(hostIdValue: string, containerId: string, action: "start" | "stop" | "restart") {
    setActionLoading(containerId);
    try {
      if (action === "start") await dockerApi.startContainer(hostIdValue, containerId);
      else if (action === "stop") await dockerApi.stopContainer(hostIdValue, containerId);
      else await dockerApi.restartContainer(hostIdValue, containerId);
    } catch (e) {
      console.error(`Container ${action} failed:`, e);
    } finally {
      setActionLoading(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStateTab("all");
    setHostFilter("");
    setImageFilter("");
  }

  if (hostsLoading || containersLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Containers" breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]} />
        <div className="glass-card p-8 text-center"><p className="text-sm text-destructive">Failed to load containers: {errorMessage}</p></div>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Containers" breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]} />
        <div className="glass-card p-6 sm:p-12 text-center">
          <Box className="mx-auto mb-3 sm:mb-4 h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          <h2 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold">No containers found</h2>
          <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground">
            {hosts.length === 0 ? "Connect a Docker host first, then containers will appear here." : "No containers are currently running on your connected hosts."}
          </p>
          {hosts.length === 0 && <Link to="/app/hosts"><Button variant="outline" size="sm" className="sm:size-default">Go to Hosts</Button></Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <PageHeader
        title="Containers"
        description={`${containers.length} containers across ${uniqueHosts.length} host(s)`}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TelemetryBadge loading={fleetMetricsLoading} available={telemetryAvailable} partial={telemetryPartial} autoRefresh={true} />
          </div>
        }
      />

      {auxiliaryErrorMessage ? (
        <div className="rounded-2xl border border-white/10 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
          <p className="text-destructive">{auxiliaryErrorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <SignalCard label="Fleet CPU" value={fleetCpuCard.value} helper={fleetCpuCard.helper} icon={Cpu} tone={fleetCpuCard.status} progress={fleetCpuCard.progress} />
        <SignalCard label="Fleet Memory" value={fleetMemoryCard.value} helper={fleetMemoryCard.helper} icon={MemoryStick} tone={fleetMemoryCard.status} progress={fleetMemoryCard.progress} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Total" value={kpi.total} subtext="Tracked containers" icon={Box} status="neutral" />
        <KPICard label="Running" value={kpi.running} subtext="Actively serving traffic" icon={Activity} status={kpi.running > 0 ? "success" : "neutral"} />
        <KPICard label="Unhealthy" value={kpi.unhealthy} subtext="Immediate investigation" icon={AlertTriangle} status={kpi.unhealthy > 0 ? "destructive" : "neutral"} />
        <KPICard label="Restarting" value={kpi.restarting} subtext="Potential crash loops" icon={RotateCw} status={kpi.restarting > 0 ? "warning" : "neutral"} />
      </div>

      <div className="glass-card overflow-hidden rounded-2xl sm:rounded-[28px]">
        <div className="border-b border-white/5 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">Containers</h3>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
                Live stats update automatically.
              </p>
            </div>
            <div className="self-start md:self-auto rounded-full border border-white/10 bg-background/35 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Showing {filtered.length} of {containers.length}</div>
          </div>
        </div>

        <div className="border-b border-white/5 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search containers, images, or hosts..." className="h-10 rounded-full border-white/10 bg-background/40 pl-10 text-xs sm:text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-background/35 p-1 overflow-x-auto flex-nowrap">
                {STATE_TABS.map((tab) => {
                  const isActive = stateTab === tab.key;
                  const count = tab.key === "all" ? containers.length : tab.key === "unhealthy" ? kpi.unhealthy : tab.key === "running" ? kpi.running : tab.key === "restarting" ? kpi.restarting : containers.filter((c) => c.State === tab.key).length;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setStateTab(tab.key)}
                      className={cn("whitespace-nowrap rounded-full px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs transition-colors", isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      <span className="font-medium">{tab.label}</span>
                      <span className="ml-1 text-[9px] sm:text-[10px] tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <select value={hostFilter} onChange={(e) => setHostFilter(e.target.value)} className="appearance-none rounded-full border border-white/10 bg-background/40 px-3 sm:px-4 py-1.5 sm:py-2 pr-7 sm:pr-9 text-[10px] sm:text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All hosts</option>
                  {uniqueHosts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-3 sm:h-3.5 w-3 sm:w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>

              <div className="relative">
                <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value)} className="max-w-[140px] sm:max-w-[180px] appearance-none truncate rounded-full border border-white/10 bg-background/40 px-3 sm:px-4 py-1.5 sm:py-2 pr-7 sm:pr-9 text-[10px] sm:text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All images</option>
                  {uniqueImages.map((img) => <option key={img} value={img}>{shortenImage(img)}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-3 sm:h-3.5 w-3 sm:w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>

              {hasActiveFilters ? <Button variant="ghost" className="rounded-full px-3 sm:px-4 text-[10px] sm:text-xs" onClick={clearFilters}>Clear</Button> : null}
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
              {search ? <span className="rounded-full border border-primary/20 bg-primary/10 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-primary">Search: {search}</span> : null}
              {stateTab !== "all" ? <span className="rounded-full border border-white/10 bg-background/45 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-muted-foreground">State: {STATE_TABS.find((tab) => tab.key === stateTab)?.label}</span> : null}
              {hostFilter ? <span className="rounded-full border border-white/10 bg-background/45 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-muted-foreground">Host: {activeHostLabel}</span> : null}
              {imageFilter ? <span className="rounded-full border border-white/10 bg-background/45 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-muted-foreground">Image: {shortenImage(imageFilter)}</span> : null}
            </div>
          ) : null}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/5 bg-muted/20 hover:bg-muted/20">
              <TableHead className="px-6 text-[11px] uppercase tracking-[0.18em]">Container</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.18em]">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.18em]">Host</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] uppercase tracking-[0.18em]">Image</TableHead>
              <TableHead className="hidden xl:table-cell text-right text-[11px] uppercase tracking-[0.18em]">CPU</TableHead>
              <TableHead className="hidden xl:table-cell text-right text-[11px] uppercase tracking-[0.18em]">Memory</TableHead>
              <TableHead className="hidden xl:table-cell text-right text-[11px] uppercase tracking-[0.18em]">Net I/O</TableHead>
              <TableHead className="hidden md:table-cell text-right text-[11px] uppercase tracking-[0.18em]">Restarts</TableHead>
              <TableHead className="hidden md:table-cell text-right text-[11px] uppercase tracking-[0.18em]">Age</TableHead>
              <TableHead className="w-[116px] text-right text-[11px] uppercase tracking-[0.18em]">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="px-6 py-14 text-center text-sm text-muted-foreground">No containers match the current filters.</TableCell>
              </TableRow>
            ) : null}

            {filtered.map((c) => {
              const name = (c.Names?.[0] || c.Id?.substring(0, 12) || "unknown").replace(/^\//, "");
              const health = (c.Status || "").toLowerCase().includes("unhealthy") ? "unhealthy" : undefined;
              const badge = mapState(c.State, health);
              const isExited = c.State === "exited";
              const isRunning = c.State === "running";
              const restartCount = c.RestartCount ?? (c.HostConfig?.RestartPolicy?.MaximumRetryCount || 0);
              const borderClass = severityBorderClass(c.State, health);

              return (
                <TableRow key={c.Id || name} className={cn("border-b border-white/5 hover:bg-background/60", isExited && "opacity-70", borderClass)}>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", isRunning ? "border-primary/20 bg-primary/10" : "border-white/10 bg-background/35")}>
                        <Box className={cn("h-5 w-5", isRunning ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <Link to={`/app/containers/${c.Id?.substring(0, 12)}?host=${c._hostId}`} className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary">{name}</Link>
                        <p className="mt-1 text-[11px] font-mono text-muted-foreground/70">{c.Id?.substring(0, 12)}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-4"><StatusBadge status={badge} /></TableCell>

                  <TableCell className="py-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
                      <Server className="h-3.5 w-3.5" />
                      <span className="max-w-[120px] truncate">{c._hostName || "--"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden py-4 lg:table-cell"><div className="max-w-[200px] truncate text-xs text-muted-foreground">{shortenImage(c.Image)}</div></TableCell>

                  <TableCell className="hidden py-4 text-right text-xs tabular-nums xl:table-cell">
                    {(() => {
                      const s = statsMap.get(c.Id);
                      if (!s || !isRunning) return <span className="text-muted-foreground">--</span>;
                      return <span className={cn(s.cpu_percent > 80 ? "font-semibold text-warning" : "text-muted-foreground")}>{s.cpu_percent}%</span>;
                    })()}
                  </TableCell>

                  <TableCell className="hidden py-4 text-right text-xs tabular-nums xl:table-cell">
                    {(() => {
                      const s = statsMap.get(c.Id);
                      if (!s || !isRunning) return <span className="text-muted-foreground">--</span>;
                      const pct = s.memory_limit > 0 ? Math.round((s.memory_usage / s.memory_limit) * 100) : 0;
                      return (
                        <div className="space-y-1">
                          <div className={cn(pct > 85 ? "font-semibold text-warning" : "text-muted-foreground")}>{formatBytes(s.memory_usage)}</div>
                          <div className="text-[10px] text-muted-foreground/60">{pct}% of {formatBytes(s.memory_limit)}</div>
                        </div>
                      );
                    })()}
                  </TableCell>

                  <TableCell className="hidden py-4 text-right text-xs tabular-nums xl:table-cell">
                    {(() => {
                      const s = statsMap.get(c.Id);
                      if (!s || !isRunning) return <span className="text-muted-foreground">--</span>;
                      return <span className="text-muted-foreground">{formatNetIO(s.net_rx, s.net_tx)}</span>;
                    })()}
                  </TableCell>

                  <TableCell className="hidden py-4 text-right text-xs tabular-nums md:table-cell"><span className={cn(restartCount > 0 ? "font-semibold text-warning" : "text-muted-foreground")}>{restartCount}</span></TableCell>
                  <TableCell className="hidden py-4 text-right text-xs tabular-nums text-muted-foreground md:table-cell">{relativeAge(c.Created)}</TableCell>

                  <TableCell className="py-4 text-right">
                    {actionLoading === c.Id ? (
                      <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
                    ) : isRunning ? (
                      <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-background/35 p-1">
                        <button onClick={() => handleAction(c._hostId, c.Id, "restart")} title="Restart" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning"><RotateCw className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleAction(c._hostId, c.Id, "stop")} title="Stop" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Square className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => handleAction(c._hostId, c.Id, "start")} title="Start" className="inline-flex items-center rounded-full border border-white/10 bg-background/35 p-2 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"><Play className="h-3.5 w-3.5" /></button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
