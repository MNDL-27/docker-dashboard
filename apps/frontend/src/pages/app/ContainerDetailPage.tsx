import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Activity,
  Box,
  CheckCircle2,
  Cpu,
  HardDrive,
  Loader2,
  Network,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  Settings2,
  Square,
  TerminalSquare,
  FolderOpen,
  Lock,
} from "lucide-react";

import { LogConsole } from "@/components/docker/LogConsole";
import { HostUpgradeDialog } from "@/components/hosts/HostUpgradeDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn, formatBytes } from "@/lib/utils";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { useContainerInspect, useContainerLogs, useContainerStats, useDockerHosts } from "@/hooks/useDocker";
import { useViewerState } from "@/hooks/useViewerState";
import { dockerApi } from "@/services/docker-api";
import { PLAN_POLICY_BY_PLAN, normalizePlan } from "../../../../../shared/schema/plan-policy";
import { useToast } from "@/hooks/use-toast";

interface DockerContainerStats {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
  blkio_stats?: { io_service_bytes_recursive?: Array<{ value?: number }> };
}

interface DockerContainerInspect {
  Name?: string;
  Image?: string;
  RestartCount?: number;
  Config?: { Image?: string; Env?: string[]; Labels?: Record<string, string> };
  HostConfig?: { PortBindings?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null> };
  NetworkSettings?: {
    Networks?: Record<string, { IPAddress?: string }>;
    Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null>;
  };
  State?: {
    Status?: string;
    Health?: { Status?: string };
    Running?: boolean;
    Paused?: boolean;
    StartedAt?: string;
    RestartCount?: number;
  };
}

interface DockerPortBinding {
  HostIp?: string;
  HostPort?: string;
}

function formatCount(value: number | string | undefined | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? String(numeric) : "0";
}

function calcCpuPercent(stats: DockerContainerStats | null | undefined) {
  if (!stats?.cpu_stats || !stats?.precpu_stats) return "0.0";
  const cpuDelta = (stats.cpu_stats.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats.cpu_usage?.total_usage ?? 0);
  const sysDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
  const cpus = stats.cpu_stats.online_cpus || 1;
  return sysDelta > 0 ? ((cpuDelta / sysDelta) * cpus * 100).toFixed(1) : "0.0";
}

function calcNetworkIo(stats: DockerContainerStats | null | undefined) {
  const networks = stats?.networks;
  if (!networks || typeof networks !== "object") {
    return null;
  }

  let rx = 0;
  let tx = 0;
  for (const value of Object.values(networks)) {
    rx += Number(value?.rx_bytes || 0);
    tx += Number(value?.tx_bytes || 0);
  }

  return { rx, tx, total: rx + tx };
}

function calcBlkioTotal(stats: DockerContainerStats | null | undefined) {
  const entries = stats?.blkio_stats?.io_service_bytes_recursive;
  if (!Array.isArray(entries)) return null;

  let total = 0;
  for (const entry of entries) {
    total += Number(entry?.value || 0);
  }

  return total > 0 ? total : 0;
}

function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond === null || bytesPerSecond === undefined || bytesPerSecond < 0) {
    return "0 B/s";
  }
  if (bytesPerSecond === 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

interface NetworkSnapshot {
  rx: number;
  tx: number;
  timestamp: number;
}

interface NetworkSpeed {
  rxPerSec: number;
  txPerSec: number;
  totalPerSec: number;
}

function getPrimaryIp(inspect: DockerContainerInspect | null | undefined) {
  const networks = inspect?.NetworkSettings?.Networks;
  if (!networks || typeof networks !== "object") return null;

  for (const value of Object.values(networks)) {
    if (value?.IPAddress) {
      return value.IPAddress;
    }
  }

  return null;
}

function getContainerHealth(state: DockerContainerInspect["State"] | null | undefined) {
  const healthStatus = state?.Health?.Status;
  if (healthStatus === "healthy") return "healthy";
  if (healthStatus === "unhealthy") return "unhealthy";
  if (state?.Running) return "running";
  if (state?.Paused) return "paused";
  return "stopped";
}

function formatContainerUptime(startedAt: string | undefined) {
  if (!startedAt || startedAt === "0001-01-01T00:00:00Z") return "Unavailable";
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return formatDistanceToNowStrict(date);
}

function DetailStatCard({
  title,
  value,
  helper,
  valueTone = "text-primary",
  progress,
}: {
  title: string;
  value: string;
  helper?: string;
  valueTone?: string;
  progress?: number | null;
}) {
  const width = progress !== null && progress !== undefined ? `${Math.max(0, Math.min(100, progress))}%` : null;

  return (
    <div className="glass-card rounded-[28px] p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <span className={cn("text-4xl font-semibold tracking-tight", valueTone)}>{value}</span>
      </div>
      {width ? (
        <div className="mt-8 space-y-3">
          <div className="flex h-24 items-end gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "flex-1 rounded-t-md bg-primary/15",
                  index === 6 && "bg-primary",
                )}
                style={{ height: `${Math.max(30, Math.min(100, progress ?? 0) * (0.45 + index * 0.08))}%` }}
              />
            ))}
          </div>
          {helper ? <p className="text-sm text-muted-foreground">{helper}</p> : null}
        </div>
      ) : helper ? (
        <div className="mt-8">
          <div className="h-4 rounded-full bg-white/5">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{helper}</p>
        </div>
      ) : null}
    </div>
  );
}

function MiniSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card rounded-[28px] p-6">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-4 text-5xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-2xl border border-white/10 bg-background/40 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="break-all font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

type ContainerAction = "container-start" | "container-stop" | "container-restart";

function getContainerActionFn(action: ContainerAction) {
  if (action === "container-start") return dockerApi.startContainer;
  if (action === "container-stop") return dockerApi.stopContainer;
  return dockerApi.restartContainer;
}

function getHealthStatusTone(health: string): string {
  if (health === "healthy" || health === "running") {
    return "border-success/20 bg-success/10 text-success";
  }
  if (health === "unhealthy") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  return "border-warning/20 bg-warning/10 text-warning";
}

function HostAccessRestrictedView({
  nodeLimit,
  upgradeDialogOpen,
  setUpgradeDialogOpen,
}: {
  nodeLimit: number | null;
  upgradeDialogOpen: boolean;
  setUpgradeDialogOpen: (open: boolean) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Access Restricted"
        description="Host limit exceeded"
        breadcrumbs={[{ label: "Containers", href: "/app/containers" }, { label: "Restricted" }]}
      />
      <div className="glass-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <Lock className="h-6 w-6 text-warning" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Host Access Restricted</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          This container belongs to a host that exceeds your current plan's node limit ({nodeLimit} node{nodeLimit === 1 ? "" : "s"}).
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link to="/app/containers">Back to Containers</Link>
          </Button>
          <Button onClick={() => setUpgradeDialogOpen(true)}>
            Upgrade Plan
          </Button>
        </div>
      </div>
      <HostUpgradeDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen} nodeLimit={nodeLimit} />
    </div>
  );
}

export default function ContainerDetailPage() {
  const { id: containerId } = useParams();
  const [searchParams] = useSearchParams();
  const hostId = searchParams.get("host");
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;

  const { data: allowedHosts = [], isLoading: hostsLoading } = useDockerHosts(viewer?.active_org_id ?? null, { filterByPlan: true });
  const isHostAllowed = hostId ? allowedHosts.some(h => h.id === hostId) : false;

  // Only fetch container data if the host passes plan entitlement checks
  const guardedHostId = isHostAllowed ? hostId : null;
  const { data: inspect, isLoading: inspectLoading, error: inspectError } = useContainerInspect(guardedHostId, containerId);
  const {
    data: stats,
    error: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useContainerStats(guardedHostId, containerId, 10000);

  // ── Real-time network speed tracking ──
  // Track previous stats snapshot to compute bytes/sec delta between polls
  const prevNetworkRef = useRef<NetworkSnapshot | null>(null);
  const [networkSpeed, setNetworkSpeed] = useState<NetworkSpeed | null>(null);

  useEffect(() => {
    const currentIo = calcNetworkIo(stats);
    if (!currentIo) {
      return;
    }

    const now = Date.now();
    const prev = prevNetworkRef.current;

    if (prev) {
      const elapsedSec = (now - prev.timestamp) / 1000;
      // Only compute speed if at least 1 second has elapsed (avoid division by zero / spikes)
      if (elapsedSec >= 1) {
        const rxDelta = Math.max(0, currentIo.rx - prev.rx);
        const txDelta = Math.max(0, currentIo.tx - prev.tx);
        const rxPerSec = rxDelta / elapsedSec;
        const txPerSec = txDelta / elapsedSec;
        setNetworkSpeed({
          rxPerSec,
          txPerSec,
          totalPerSec: rxPerSec + txPerSec,
        });
      }
    }

    prevNetworkRef.current = {
      rx: currentIo.rx,
      tx: currentIo.tx,
      timestamp: now,
    };
  }, [stats]);
  
  // MANUAL LOG FETCHING ONLY: To save Netlify resources, we never fetch logs automatically on this page.
  const [logsRequested, setLogsRequested] = useState(false);
  const { data: logsData, isFetching: logsLoading, refetch: refetchLogs } = useContainerLogs(
    logsRequested ? guardedHostId : null, 
    containerId, 
    { tail: 200 }
  );

  const handleManualLogFetch = async () => {
    setLogsRequested(true);
    await refetchLogs();
  };

  const handleAction = async (action: ContainerAction) => {
    if (!hostId || !containerId) return;
    const label = action.replace("container-", "");
    setActionLoading(label);

    try {
      const fn = getContainerActionFn(action);
      const result = await fn(hostId, containerId);
      toast({ title: result.ok ? `Container ${label}ed` : `${label} failed` });
      queryClient.invalidateQueries({ queryKey: ["container-inspect", hostId, containerId] });
      queryClient.invalidateQueries({ queryKey: ["container-stats", hostId, containerId] });
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["host-containers"] });
    } catch (error) {
      toast({ title: `${label} failed`, description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }

    setActionLoading(null);
  };

  if (!hostId) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        Missing host parameter. Go back to <Link to="/app/containers" className="text-primary hover:underline">Containers</Link>.
      </div>
    );
  }

  if (hostsLoading || inspectLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isHostAllowed && allowedHosts.length > 0) {
    const normalizedPlan = normalizePlan(effectivePlan);
    const fallbackNodeLimit = PLAN_POLICY_BY_PLAN[normalizedPlan].nodeLimit;
    const nodeLimit = viewer?.entitlements ? viewer.entitlements.nodeLimit : fallbackNodeLimit;

    return (
      <HostAccessRestrictedView
        nodeLimit={nodeLimit}
        upgradeDialogOpen={upgradeDialogOpen}
        setUpgradeDialogOpen={setUpgradeDialogOpen}
      />
    );
  }

  if (inspectError || !inspect) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-sm text-destructive">Failed to load container: {(inspectError as Error)?.message || "Not found"}</p>
      </div>
    );
  }

  const name = (inspect.Name || "").replace(/^\//, "");
  const state = inspect.State || {};
  const config = inspect.Config || {};
  const cpuPercent = calcCpuPercent(stats);
  const memUsage = stats?.memory_stats?.usage || 0;
  const memLimit = stats?.memory_stats?.limit || 0;
  const memPercent = memLimit > 0 ? Number(((memUsage / memLimit) * 100).toFixed(1)) : 0;
  const restartCount = state.RestartCount || inspect.RestartCount || 0;
  const uptime = formatContainerUptime(state.StartedAt);
  const logs: string[] = logsData?.logs || [];
  const primaryIp = getPrimaryIp(inspect) || "No IP";
  const health = getContainerHealth(state);
  const networkIo = calcNetworkIo(stats);
  const blkioTotal = calcBlkioTotal(stats);
  const statusTone = getHealthStatusTone(health);

  const environment = Array.isArray(config.Env) ? config.Env : [];
  const networks = inspect.NetworkSettings?.Networks ? Object.entries(inspect.NetworkSettings.Networks) : [];
  const portBindings = inspect.HostConfig?.PortBindings ? Object.entries(inspect.HostConfig.PortBindings) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={name || containerId || ""}
        description={config.Image}
        breadcrumbs={[{ label: "Containers", href: "/app/containers" }, { label: name || containerId || "" }]}
      />

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr),220px,220px]">
          <div className="glass-card rounded-[28px] p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-primary/20 bg-primary/10">
                  <Box className="h-11 w-11 text-primary" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-4xl font-semibold tracking-tight text-foreground">{name || containerId}</h2>
                    <span className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium uppercase tracking-[0.14em]", statusTone)}>
                      <Activity className="h-4 w-4" />
                      {health}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xl text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <ScrollText className="h-4 w-4" />
                      {config.Image || "Unknown image"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      {primaryIp}
                    </span>
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {state.Running ? "Running" : state.Status || "Stopped"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <MiniSummaryCard label="Uptime" value={uptime} />
          <MiniSummaryCard label="Restarts" value={formatCount(restartCount)} />
        </div>

        <div className="glass-card rounded-[28px] px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="gap-2 rounded-full px-7"
                disabled={!!actionLoading || state.Running}
                onClick={() => handleAction("container-start")}
              >
                {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-full px-7"
                disabled={!!actionLoading || !state.Running}
                onClick={() => handleAction("container-stop")}
              >
                {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Stop
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-full px-7"
                disabled={!!actionLoading}
                onClick={() => handleAction("container-restart")}
              >
                {actionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Restart
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="gap-2 rounded-full px-7">
                    <Settings2 className="h-4 w-4" />
                    View Config
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-background/95 p-6 sm:max-w-2xl">
                  <SheetHeader>
                    <SheetTitle>{name || containerId}</SheetTitle>
                    <SheetDescription>Container inspect, environment, networking, and port binding details.</SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <ConfigRow label="Container ID" value={(inspect.Id || "").substring(0, 12) || "-"} />
                      <ConfigRow label="Image" value={config.Image || "-"} />
                      <ConfigRow label="Status" value={state.Status || "-"} />
                      <ConfigRow label="Restart policy" value={inspect.HostConfig?.RestartPolicy?.Name || "-"} />
                      <ConfigRow label="Started at" value={state.StartedAt ? new Date(state.StartedAt).toLocaleString() : "-"} />
                      <ConfigRow
                        label="Finished at"
                        value={
                          state.FinishedAt && state.FinishedAt !== "0001-01-01T00:00:00Z"
                            ? new Date(state.FinishedAt).toLocaleString()
                            : "-"
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Environment</h3>
                      {environment.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
                          No environment variables set.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {environment.map((env: string, index: number) => {
                            const [key, ...rest] = env.split("=");
                            return (
                              <div key={`${key}-${index}`} className="rounded-2xl border border-white/10 bg-background/40 p-4 font-mono text-sm">
                                <span className="font-semibold text-primary">{key}</span>
                                <span className="text-muted-foreground">={rest.join("=")}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Networking</h3>
                      {networks.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
                          No attached networks.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {networks.map(([networkName, network]: [string, { IPAddress?: string }]) => (
                            <div key={networkName} className="rounded-2xl border border-white/10 bg-background/40 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{networkName}</p>
                              <p className="mt-2 font-mono text-sm">{network?.IPAddress || "-"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Port bindings</h3>
                      {portBindings.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
                          No port bindings.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {portBindings.map(([port, bindings]: [string, DockerPortBinding[] | null | undefined]) => (
                            <div key={port} className="rounded-2xl border border-white/10 bg-background/40 p-4 font-mono text-sm">
                              {port} - {(bindings || []).map((binding) => `${binding.HostIp || "0.0.0.0"}:${binding.HostPort}`).join(", ")}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" className="gap-2 rounded-full px-7" disabled title="Container shell is not available in the current agent API.">
                <TerminalSquare className="h-4 w-4" />
                Shell
              </Button>
              <Link to={`/app/files?host=${hostId}&container=${containerId}`}>
                <Button variant="outline" className="gap-2 rounded-full px-7">
                  <FolderOpen className="h-4 w-4" />
                  Browse Files
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {statsError instanceof Error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {statsError.message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-4">
          <DetailStatCard
            title="CPU usage"
            value={`${cpuPercent}%`}
            helper="Current sample from Docker stats"
            progress={Number(cpuPercent)}
          />
          <DetailStatCard
            title="Memory"
            value={formatBytes(memUsage)}
            helper={memLimit > 0 ? `${memPercent}% of ${formatBytes(memLimit)}` : "Memory limit unavailable"}
            progress={memLimit > 0 ? memPercent : 0}
          />
          <DetailStatCard
            title="Network I/O"
            value={networkSpeed ? formatSpeed(networkSpeed.totalPerSec) : networkIo ? "Measuring…" : "Unavailable"}
            helper={
              networkIo
                ? `Total: ${formatBytes(networkIo.total)} · RX ${formatBytes(networkIo.rx)} / TX ${formatBytes(networkIo.tx)}${networkSpeed ? ` · ↓ ${formatSpeed(networkSpeed.rxPerSec)} ↑ ${formatSpeed(networkSpeed.txPerSec)}` : ""}`
                : "Network stats unavailable"
            }
            progress={
              networkSpeed
                ? Math.min(100, (networkSpeed.totalPerSec / (1024 * 1024 * 100)) * 100)  // Scale to 100 MB/s
                : null
            }
          />
          <DetailStatCard
            title="Disk usage"
            value={blkioTotal !== null ? formatBytes(blkioTotal) : "Unavailable"}
            helper={blkioTotal !== null ? "Block I/O total reported by Docker stats" : "Container filesystem usage is not exposed by the current agent"}
            progress={null}
            valueTone={blkioTotal !== null ? "text-primary" : "text-muted-foreground"}
          />
        </div>

        <PremiumFeatureBlock
          title="Container Logs are a paid feature"
          description="Upgrade your plan to view real-time container logs, terminal output, and history."
          hasAccess={viewer?.entitlements?.canUseLogs ?? false}
        >
          <LogConsole
            logs={logs}
            loading={logsLoading}
            title={`Live logs - ${name || containerId}`}
            emptyMessage="No logs available for this container."
            heightClassName="h-[560px]"
            onRefresh={() => refetchLogs()}
            refreshLabel="Refresh logs"
          />
        </PremiumFeatureBlock>
      </div>
    </div>
  );
}
