import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/dashboard/KPICard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Loader2, Box, Play, Square, RotateCw,
  Server, Cpu, MemoryStick, Activity, AlertTriangle,
  ChevronDown
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useOrganization } from "@clerk/clerk-react";
import { useContainers, useDockerHosts } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { cn } from "@/lib/utils";

/* ─── helpers ─── */
function relativeAge(created?: number): string {
  if (!created) return "—";
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
  if (!img) return "—";
  // strip "sha256:" prefix and registry prefix for display
  const parts = img.split("/");
  return parts[parts.length - 1] || img;
}

/* ─── status mapping ─── */
type BadgeStatus = "running" | "unhealthy" | "exited" | "restarting" | "paused" | "critical" | "warning";
function mapState(state?: string, health?: string): BadgeStatus {
  if (health === "unhealthy") return "unhealthy";
  if (state === "running") return "running";
  if (state === "exited") return "exited";
  if (state === "restarting") return "restarting";
  if (state === "paused") return "paused";
  return "exited";
}

/* ─── severity accent color ─── */
function severityBorderClass(state?: string, health?: string): string {
  if (health === "unhealthy") return "border-l-2 border-l-destructive/60";
  if (state === "restarting") return "border-l-2 border-l-warning/60";
  return "";
}

/* ─── tab definitions ─── */
const STATE_TABS = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "unhealthy", label: "Unhealthy" },
  { key: "restarting", label: "Restarting" },
  { key: "exited", label: "Exited" },
] as const;

/* ─── main ─── */
export default function ContainersPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id);
  const { data: rawContainers, isLoading: containersLoading, error } = useContainers(currentOrg?.id, hosts.length > 0);

  const [search, setSearch] = useState("");
  const [stateTab, setStateTab] = useState("all");
  const [hostFilter, setHostFilter] = useState("");
  const [imageFilter, setImageFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const containers: any[] = useMemo(
    () => (Array.isArray(rawContainers) ? rawContainers : []),
    [rawContainers]
  );

  /* derive unique hosts and images for filters */
  const uniqueHosts = useMemo(() => {
    const map = new Map<string, string>();
    containers.forEach((c: any) => {
      if (c._hostId && c._hostName) map.set(c._hostId, c._hostName);
    });
    return Array.from(map.entries()); // [id, name]
  }, [containers]);

  const uniqueImages = useMemo(() => {
    const set = new Set<string>();
    containers.forEach((c: any) => { if (c.Image) set.add(c.Image); });
    return Array.from(set).sort();
  }, [containers]);

  /* KPI aggregations */
  const kpi = useMemo(() => {
    let running = 0, unhealthy = 0, restarting = 0;
    containers.forEach((c: any) => {
      if (c.State === "running") running++;
      // Docker health status is nested in Status string
      const status = (c.Status || "").toLowerCase();
      if (status.includes("unhealthy") || c.State === "unhealthy") unhealthy++;
      if (c.State === "restarting") restarting++;
    });
    return {
      total: containers.length,
      running,
      unhealthy,
      restarting,
    };
  }, [containers]);

  /* filtering */
  const filtered = useMemo(() => {
    return containers.filter((c: any) => {
      // text search
      const name = (c.Names?.[0] || "").replace(/^\//, "").toLowerCase();
      const image = (c.Image || "").toLowerCase();
      const q = search.toLowerCase();
      if (q && !name.includes(q) && !image.includes(q)) return false;
      // state tab
      if (stateTab === "unhealthy") {
        const status = (c.Status || "").toLowerCase();
        if (!status.includes("unhealthy") && c.State !== "unhealthy") return false;
      } else if (stateTab !== "all" && c.State !== stateTab) {
        return false;
      }
      // host filter
      if (hostFilter && c._hostId !== hostFilter) return false;
      // image filter
      if (imageFilter && c.Image !== imageFilter) return false;
      return true;
    });
  }, [containers, search, stateTab, hostFilter, imageFilter]);

  /* container actions */
  async function handleAction(hostId: string, containerId: string, action: "start" | "stop" | "restart") {
    setActionLoading(containerId);
    try {
      if (action === "start") await dockerApi.startContainer(hostId, containerId);
      else if (action === "stop") await dockerApi.stopContainer(hostId, containerId);
      else await dockerApi.restartContainer(hostId, containerId);
    } catch (e) {
      console.error(`Container ${action} failed:`, e);
    } finally {
      setActionLoading(null);
    }
  }

  /* ─── loading ─── */
  if (hostsLoading || containersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ─── error ─── */
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Containers" breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]} />
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-destructive">Failed to load containers: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  /* ─── empty ─── */
  if (containers.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Containers" breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]} />
        <div className="glass-card p-12 text-center">
          <Box className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No containers found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {hosts.length === 0
              ? "Connect a Docker host first, then containers will appear here."
              : "No containers are currently running on your connected hosts."}
          </p>
          {hosts.length === 0 && (
            <Link to="/app/hosts"><Button variant="outline">Go to Hosts</Button></Link>
          )}
        </div>
      </div>
    );
  }

  /* ─── render ─── */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Containers"
        description={`${containers.length} containers across ${uniqueHosts.length} host(s)`}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]}
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Total"
          value={kpi.total}
          icon={Box}
          status="neutral"
        />
        <KPICard
          label="Running"
          value={kpi.running}
          icon={Activity}
          status={kpi.running > 0 ? "success" : "neutral"}
        />
        <KPICard
          label="Unhealthy"
          value={kpi.unhealthy}
          icon={AlertTriangle}
          status={kpi.unhealthy > 0 ? "destructive" : "neutral"}
        />
        <KPICard
          label="Restarting"
          value={kpi.restarting}
          icon={RotateCw}
          status={kpi.restarting > 0 ? "warning" : "neutral"}
        />
        <KPICard
          label="Total CPU"
          value="—"
          subtext="list-level stats N/A"
          icon={Cpu}
          status="neutral"
        />
        <KPICard
          label="Total Memory"
          value="—"
          subtext="list-level stats N/A"
          icon={MemoryStick}
          status="neutral"
        />
      </div>

      {/* Toolbar: Search + Tabs + Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search containers or images…"
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* State Tabs */}
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          {STATE_TABS.map((tab) => {
            const isActive = stateTab === tab.key;
            const count =
              tab.key === "all" ? containers.length :
              tab.key === "unhealthy" ? kpi.unhealthy :
              tab.key === "running" ? kpi.running :
              tab.key === "restarting" ? kpi.restarting :
              containers.filter((c: any) => c.State === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setStateTab(tab.key)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-card text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] tabular-nums",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Host Filter */}
        <div className="relative">
          <select
            value={hostFilter}
            onChange={(e) => setHostFilter(e.target.value)}
            className="appearance-none bg-secondary border border-border rounded-md text-xs px-3 py-1.5 pr-7 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All hosts</option>
            {uniqueHosts.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Image Filter */}
        <div className="relative">
          <select
            value={imageFilter}
            onChange={(e) => setImageFilter(e.target.value)}
            className="appearance-none bg-secondary border border-border rounded-md text-xs px-3 py-1.5 pr-7 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring max-w-[180px] truncate"
          >
            <option value="">All images</option>
            {uniqueImages.map((img) => (
              <option key={img} value={img}>{shortenImage(img)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {containers.length} containers
      </p>

      {/* Dense Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Container</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Host</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden lg:table-cell">Image</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden xl:table-cell">CPU</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden xl:table-cell">Memory</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden xl:table-cell">Net I/O</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Restarts</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Age</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    No containers match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((c: any) => {
                const name = (c.Names?.[0] || c.Id?.substring(0, 12) || "unknown").replace(/^\//, "");
                const health = (c.Status || "").toLowerCase().includes("unhealthy") ? "unhealthy" : undefined;
                const badge = mapState(c.State, health);
                const isExited = c.State === "exited";
                const isRunning = c.State === "running";
                const restartCount = c.RestartCount ?? (c.HostConfig?.RestartPolicy?.MaximumRetryCount || 0);
                const borderClass = severityBorderClass(c.State, health);

                return (
                  <tr
                    key={c.Id || name}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors hover:bg-accent/30",
                      isExited && "opacity-60",
                      borderClass
                    )}
                  >
                    {/* Container name */}
                    <td className="px-3 py-2">
                      <Link
                        to={`/app/containers/${c.Id?.substring(0, 12)}?host=${c._hostId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors text-sm"
                      >
                        {name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                        {c.Id?.substring(0, 12)}
                      </p>
                    </td>

                    {/* Host */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Server className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {c._hostName || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Status chip */}
                    <td className="px-3 py-2">
                      <StatusBadge status={badge} />
                    </td>

                    {/* Image */}
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <span className="font-mono text-xs text-muted-foreground truncate block max-w-[180px]">
                        {shortenImage(c.Image)}
                      </span>
                    </td>

                    {/* CPU */}
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums hidden xl:table-cell">
                      —
                    </td>

                    {/* Memory */}
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums hidden xl:table-cell">
                      —
                    </td>

                    {/* Net I/O */}
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums hidden xl:table-cell">
                      —
                    </td>

                    {/* Restarts */}
                    <td className="px-3 py-2 text-right text-xs tabular-nums hidden md:table-cell">
                      <span className={cn(
                        restartCount > 0 ? "text-warning font-medium" : "text-muted-foreground"
                      )}>
                        {restartCount}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                      {relativeAge(c.Created)}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2 text-right">
                      {actionLoading === c.Id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground inline" />
                      ) : isRunning ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleAction(c._hostId, c.Id, "restart")}
                            title="Restart"
                            className="p-1 rounded hover:bg-warning/10 text-muted-foreground hover:text-warning transition-colors"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleAction(c._hostId, c.Id, "stop")}
                            title="Stop"
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAction(c._hostId, c.Id, "start")}
                          title="Start"
                          className="p-1 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
