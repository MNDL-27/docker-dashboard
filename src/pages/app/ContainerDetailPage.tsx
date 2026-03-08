import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { useParams, useSearchParams } from "react-router-dom";
import { useContainerInspect, useContainerStats, useContainerLogs } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";
import { Cpu, HardDrive, RotateCcw, Clock, Loader2, Play, Square, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function calcCpuPercent(stats: any) {
  if (!stats?.cpu_stats || !stats?.precpu_stats) return 0;
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpus = stats.cpu_stats.online_cpus || 1;
  return sysDelta > 0 ? ((cpuDelta / sysDelta) * cpus * 100).toFixed(1) : '0.0';
}

export default function ContainerDetailPage() {
  const { id: containerId } = useParams();
  const [searchParams] = useSearchParams();
  const hostId = searchParams.get('host');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("Overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: inspect, isLoading: inspectLoading, error: inspectError } = useContainerInspect(hostId, containerId);
  const { data: stats } = useContainerStats(hostId, containerId);
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useContainerLogs(
    tab === 'Logs' ? hostId : null,
    tab === 'Logs' ? containerId : null,
    200
  );

  const handleAction = async (action: 'container-start' | 'container-stop' | 'container-restart') => {
    if (!hostId || !containerId) return;
    const label = action.replace('container-', '');
    setActionLoading(label);
    try {
      const fn = action === 'container-start' ? dockerApi.startContainer :
                 action === 'container-stop' ? dockerApi.stopContainer : dockerApi.restartContainer;
      const result = await fn(hostId, containerId);
      toast({ title: result.ok ? `Container ${label}ed` : `${label} failed` });
      queryClient.invalidateQueries({ queryKey: ['container-inspect', hostId, containerId] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['host-containers'] });
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  if (!hostId) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Missing host parameter. Go back to <a href="/app/containers" className="text-primary hover:underline">Containers</a>.</div>;
  }

  if (inspectLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (inspectError || !inspect) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-destructive text-sm">Failed to load container: {(inspectError as Error)?.message || 'Not found'}</p>
      </div>
    );
  }

  const name = (inspect.Name || '').replace(/^\//, '');
  const state = inspect.State || {};
  const config = inspect.Config || {};
  const cpuPercent = calcCpuPercent(stats);
  const memUsage = stats?.memory_stats?.usage || 0;
  const memLimit = stats?.memory_stats?.limit || 0;
  const memPercent = memLimit > 0 ? ((memUsage / memLimit) * 100).toFixed(1) : '0';
  const logs: string[] = logsData?.logs || [];
  const detailTabs = ["Overview", "Logs", "Environment", "Networking"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={name || containerId || ''}
        description={config.Image}
        breadcrumbs={[{ label: "Containers", href: "/app/containers" }, { label: name || containerId || '' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              state.Running ? 'bg-success/15 text-success' :
              state.Paused ? 'bg-warning/15 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>{state.Status || 'unknown'}</span>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!actionLoading || state.Running}
              onClick={() => handleAction('container-start')}>
              {actionLoading === 'start' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Start
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!actionLoading || !state.Running}
              onClick={() => handleAction('container-stop')}>
              {actionLoading === 'stop' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />} Stop
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!actionLoading}
              onClick={() => handleAction('container-restart')}>
              {actionLoading === 'restart' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restart
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 overflow-x-auto bg-secondary rounded-md p-0.5 w-fit">
        {detailTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="CPU" value={`${cpuPercent}%`} icon={Cpu} />
            <MetricCard label="Memory" value={`${formatBytes(memUsage)} / ${formatBytes(memLimit)}`} icon={HardDrive} />
            <MetricCard label="Mem %" value={`${memPercent}%`} icon={HardDrive} />
            <MetricCard label="Restarts" value={state.RestartCount || inspect.RestartCount || 0} icon={RotateCcw} />
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium mb-3">Container Details</h3>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                ["Name", name],
                ["ID", (inspect.Id || '').substring(0, 12)],
                ["Image", config.Image],
                ["Status", state.Status],
                ["Started", state.StartedAt ? new Date(state.StartedAt).toLocaleString() : '—'],
                ["Finished", state.FinishedAt && state.FinishedAt !== '0001-01-01T00:00:00Z' ? new Date(state.FinishedAt).toLocaleString() : '—'],
                ["Restart Policy", inspect.HostConfig?.RestartPolicy?.Name || '—'],
                ["PID", String(state.Pid || '—')],
                ["Exit Code", String(state.ExitCode ?? '—')],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="font-medium mt-0.5 font-mono text-xs break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}

      {tab === "Logs" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Container Logs (last 200 lines)</h3>
            <Button size="sm" variant="outline" onClick={() => refetchLogs()} className="gap-1.5">
              <RefreshCw className="h-3 w-3" />Refresh
            </Button>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">No logs available.</div>
          ) : (
            <div className="glass-card overflow-hidden font-mono text-xs max-h-[500px] overflow-y-auto">
              {logs.map((line, i) => (
                <div key={i} className="px-4 py-1 border-b border-border last:border-0 hover:bg-accent/30 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Environment" && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium mb-3">Environment Variables</h3>
          {(config.Env || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No environment variables set.</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {(config.Env || []).map((env: string, i: number) => {
                const [key, ...val] = env.split('=');
                return (
                  <div key={i} className="flex gap-2 py-1 border-b border-border last:border-0">
                    <span className="text-primary font-semibold shrink-0">{key}</span>
                    <span className="text-muted-foreground break-all">{val.join('=')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "Networking" && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium mb-3">Networks & Ports</h3>
          <div className="space-y-4">
            {inspect.NetworkSettings?.Networks && Object.entries(inspect.NetworkSettings.Networks).map(([netName, net]: [string, any]) => (
              <div key={netName}>
                <div className="text-xs text-muted-foreground mb-1">Network: {netName}</div>
                <div className="text-sm font-mono">IP: {net.IPAddress || '—'}</div>
              </div>
            ))}
            {inspect.HostConfig?.PortBindings && Object.entries(inspect.HostConfig.PortBindings).length > 0 ? (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Port Bindings</div>
                {Object.entries(inspect.HostConfig.PortBindings).map(([port, bindings]: [string, any]) => (
                  <div key={port} className="text-sm font-mono">
                    {port} → {(bindings || []).map((b: any) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(', ')}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No port bindings.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
