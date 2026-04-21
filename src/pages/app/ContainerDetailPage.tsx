import { useState } from "react";
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
} from "lucide-react";

import { LogConsole } from "@/components/docker/LogConsole";
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
import { cn } from "@/lib/utils";
import { useContainerInspect, useContainerLogs, useContainerStats } from "@/hooks/useDocker";
import { useViewerState } from "@/hooks/useViewerState";
import { formatScanQuotaSummary, isManualScanPlan } from "@/lib/scan-quota";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatCount(value: number | string | undefined | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? String(numeric) : "0";
}

function calcCpuPercent(stats: any) {
  if (!stats?.cpu_stats || !stats?.precpu_stats) return "0.0";
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpus = stats.cpu_stats.online_cpus || 1;
  return sysDelta > 0 ? ((cpuDelta / sysDelta) * cpus * 100).toFixed(1) : "0.0";
}

function calcNetworkIo(stats: any) {
  const networks = stats?.networks;
  if (!networks || typeof networks !== "object") {
    return null;
  }

  let rx = 0;
  let tx = 0;
  for (const value of Object.values(networks) as Array<any>) {
    rx += Number(value?.rx_bytes || 0);
    tx += Number(value?.tx_bytes || 0);
  }

  return { rx, tx, total: rx + tx };
}

function calcBlkioTotal(stats: any) {
  const entries = stats?.blkio_stats?.io_service_bytes_recursive;
  if (!Array.isArray(entries)) return null;

  let total = 0;
  for (const entry of entries) {
    total += Number(entry?.value || 0);
  }

  return total > 0 ? total : 0;
}

function getPrimaryIp(inspect: any) {
  const networks = inspect?.NetworkSettings?.Networks;
  if (!networks || typeof networks !== "object") return null;

  for (const value of Object.values(networks) as Array<any>) {
    if (value?.IPAddress) {
      return value.IPAddress;
    }
  }

  return null;
}

function getContainerHealth(state: any) {
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

export default function ContainerDetailPage() {
  const { id: containerId } = useParams();
  const [searchParams] = useSearchParams();
  const hostId = searchParams.get("host");
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const manualScanMode = isManualScanPlan(viewer?.active_org_plan);
  const scanQuotaSummary = formatScanQuotaSummary({
    plan: viewer?.active_org_plan,
    limit: viewer?.active_org_scan_limit,
    remaining: viewer?.active_org_scan_remaining,
  });

  const { data: inspect, isLoading: inspectLoading, error: inspectError } = useContainerInspect(hostId, containerId);
  const {
    data: stats,
    error: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useContainerStats(hostId, containerId, manualScanMode ? false : 10000);
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useContainerLogs(hostId, containerId, 200);

  const handleAction = async (action: "container-start" | "container-stop" | "container-restart") => {
    if (!hostId || !containerId) return;
    const label = action.replace("container-", "");
    setActionLoading(label);

    try {
      const fn =
        action === "container-start"
          ? dockerApi.startContainer
          : action === "container-stop"
            ? dockerApi.stopContainer
            : dockerApi.restartContainer;

      const result = await fn(hostId, containerId);
      toast({ title: result.ok ? `Container ${label}ed` : `${label} failed` });
      queryClient.invalidateQueries({ queryKey: ["container-inspect", hostId, containerId] });
      queryClient.invalidateQueries({ queryKey: ["container-stats", hostId, containerId] });
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["host-containers"] });
    } catch (error: any) {
      toast({ title: `${label} failed`, description: error.message, variant: "destructive" });
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

  if (inspectLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
  const statusTone =
    health === "healthy" || health === "running"
      ? "border-success/20 bg-success/10 text-success"
      : health === "unhealthy"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-warning/20 bg-warning/10 text-warning";

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
              {manualScanMode ? (
                <Button variant="outline" className="gap-2 rounded-full px-7" onClick={() => void refetchStats()} disabled={statsFetching}>
                  {statsFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Refresh live stats
                </Button>
              ) : null}
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
                          {networks.map(([networkName, network]: [string, any]) => (
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
                          {portBindings.map(([port, bindings]: [string, any]) => (
                            <div key={port} className="rounded-2xl border border-white/10 bg-background/40 p-4 font-mono text-sm">
                              {port} - {(bindings || []).map((binding: any) => `${binding.HostIp || "0.0.0.0"}:${binding.HostPort}`).join(", ")}
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
            </div>
          </div>
        </div>

        {manualScanMode || statsError ? (
          <div className="rounded-2xl border border-white/10 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
            {manualScanMode ? (
              <p>Automatic container stats refresh is disabled on the Free plan. {scanQuotaSummary || "Use Refresh live stats when you need a fresh sample."}</p>
            ) : null}
            {statsError instanceof Error ? <p className={manualScanMode ? "mt-2 text-destructive" : "text-destructive"}>{statsError.message}</p> : null}
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
            value={networkIo ? formatBytes(networkIo.total) : "Unavailable"}
            helper={networkIo ? `RX ${formatBytes(networkIo.rx)} / TX ${formatBytes(networkIo.tx)}` : "Network totals unavailable"}
            progress={networkIo ? Math.min(100, (networkIo.total / (1024 * 1024 * 10)) * 100) : null}
          />
          <DetailStatCard
            title="Disk usage"
            value={blkioTotal !== null ? formatBytes(blkioTotal) : "Unavailable"}
            helper={blkioTotal !== null ? "Block I/O total reported by Docker stats" : "Container filesystem usage is not exposed by the current agent"}
            progress={null}
            valueTone={blkioTotal !== null ? "text-primary" : "text-muted-foreground"}
          />
        </div>

        <LogConsole
          logs={logs}
          loading={logsLoading}
          title={`Live logs - ${name || containerId}`}
          emptyMessage="No logs available for this container."
          heightClassName="h-[560px]"
          onRefresh={() => refetchLogs()}
          refreshLabel="Refresh logs"
        />
      </div>
    </div>
  );
}
