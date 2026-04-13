import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { useOrganization } from "@clerk/clerk-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Activity,
  Box,
  CloudCog,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDeleteDockerHost, useDockerHosts, useHostContainers } from "@/hooks/useDocker";
import { HostMetricsFailure, HostMetricsPoint, useHostMetricsHistory } from "@/hooks/useHostMetrics";
import { useToast } from "@/hooks/use-toast";
import { dockerApi } from "@/services/docker-api";
import type { DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION, isAgentVersionOutdated } from "@/lib/agent-version";
import {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  buildWatchtowerAgentInstallCommand,
  buildWatchtowerAgentUpdateCopy,
  buildWatchtowerAgentVerifyCommand,
} from "@/lib/agent-release";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond === null || bytesPerSecond === undefined || bytesPerSecond < 0) {
    return "Unavailable";
  }
  if (bytesPerSecond === 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  return formatDistanceToNowStrict(new Date(lastSeenAt), { addSuffix: true });
}

function statusPill(status: string) {
  switch (status) {
    case "connected":
      return "bg-success/15 text-success border-success/20";
    case "unhealthy":
      return "bg-destructive/15 text-destructive border-destructive/20";
    case "stale":
    case "error":
      return "bg-warning/15 text-warning border-warning/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function statusDot(status: string) {
  switch (status) {
    case "connected":
      return "bg-success shadow-[0_0_16px_rgba(34,197,94,0.6)]";
    case "unhealthy":
      return "bg-destructive shadow-[0_0_16px_rgba(239,68,68,0.45)]";
    case "stale":
    case "error":
      return "bg-warning shadow-[0_0_16px_rgba(245,158,11,0.45)]";
    default:
      return "bg-muted-foreground/40";
  }
}

function isReadableHostStatus(status: string | null | undefined) {
  return status === "connected" || status === "stale";
}

function isDisconnectedHostStatus(status: string | null | undefined) {
  return !isReadableHostStatus(status);
}

function HostCard({
  host,
  selected,
  previewMetrics,
  onSelect,
}: {
  host: DockerHost;
  selected: boolean;
  previewMetrics?: Pick<HostMetricsPoint, "cpu" | "memory"> | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-all",
        selected
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
        <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", statusDot(host.status))} />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>CPU: {previewMetrics ? `${previewMetrics.cpu.toFixed(0)}%` : "--"}</span>
        <span>RAM: {previewMetrics ? `${previewMetrics.memory.toFixed(0)}%` : "--"}</span>
      </div>
    </button>
  );
}

function SummaryCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper?: string; icon: typeof Server }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      {helper && <p className="mt-1 text-sm text-muted-foreground">{helper}</p>}
    </div>
  );
}

function RingCard({ point }: { point: HostMetricsPoint }) {
  const value = Math.max(0, Math.min(100, point.cpu));
  return (
    <div className="glass-card min-h-[320px] p-6 flex flex-col items-center justify-center gap-5">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">CPU usage</p>
      </div>
      <div
        className="relative flex h-52 w-52 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(hsl(var(--primary)) ${value}%, rgba(255,255,255,0.06) ${value}% 100%)` }}
      >
        <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-background/95">
          <span className="text-5xl font-semibold tracking-tight">{value.toFixed(0)}%</span>
          <span className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {point.usedCores.toFixed(2)} / {point.totalCores.toFixed(2)} cores
          </span>
        </div>
      </div>
    </div>
  );
}

function MeterCard({
  title,
  value,
  helper,
  progress,
  footer,
}: {
  title: string;
  value: string;
  helper?: string;
  progress?: number;
  footer?: string;
}) {
  const width = progress === undefined ? undefined : `${Math.max(0, Math.min(100, progress))}%`;
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {helper && <span className="text-xs text-right text-muted-foreground">{helper}</span>}
      </div>
      {width && (
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width }} />
          </div>
          {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
        </div>
      )}
      {!width && footer && <p className="text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}

function TrendBars({ history, accessor }: { history: HostMetricsPoint[]; accessor: (point: HostMetricsPoint) => number | null }) {
  const values = history.map(accessor).filter((value): value is number => value !== null && value >= 0);
  const maxValue = values.length > 0 ? Math.max(...values, 1) : 1;
  const bars = history.length > 0 ? history : [];

  return (
    <div className="flex h-36 items-end gap-2">
      {(bars.length > 0 ? bars : Array.from({ length: 20 })).map((point, index) => {
        const value = point && "timestamp" in point ? accessor(point as HostMetricsPoint) ?? 0 : 0;
        const height = bars.length > 0 ? Math.max(10, Math.round((value / maxValue) * 100)) : 18 + (index % 5) * 10;
        return <div key={bars.length > 0 ? (point as HostMetricsPoint).timestamp : index} className="flex-1 rounded-t-full bg-primary/60" style={{ height: `${height}%` }} />;
      })}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-card min-h-[220px] p-6 flex flex-col justify-center text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="glass-card min-h-[220px] p-6 flex items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );
}

function AgentCommandBlock({
  label,
  command,
}: {
  label: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-foreground/90">{command}</pre>
      </div>
    </div>
  );
}

function AgentUpdateDialog({
  host,
  trigger,
}: {
  host: DockerHost;
  trigger: React.ReactNode;
}) {
  const installCommand = buildWatchtowerAgentInstallCommand(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const verifyCommand = buildWatchtowerAgentVerifyCommand();
  const updateCopy = buildWatchtowerAgentUpdateCopy(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const installedVersion = host.agent_version || "Pending";
  const latestVersion = CURRENT_WATCHTOWER_AGENT_RELEASE.version;
  const updateAvailable = isAgentVersionOutdated(host.agent_version);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Host Agent</DialogTitle>
          <DialogDescription>{updateCopy.dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Installed version</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{installedVersion}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Latest approved</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{latestVersion}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Status</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {updateAvailable ? updateCopy.statusUpdateAvailable : updateCopy.statusCurrent}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
            {updateCopy.sourcePrefix}{" "}
            <a
              href={CURRENT_WATCHTOWER_AGENT_RELEASE.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {CURRENT_WATCHTOWER_AGENT_RELEASE.sourceLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            . Installer checksum: <code className="rounded bg-background px-1.5 py-0.5">{CURRENT_WATCHTOWER_AGENT_RELEASE.installerSha256}</code>
            {updateCopy.sourceNotice ? ` ${updateCopy.sourceNotice}` : ""}
          </div>

          <AgentCommandBlock label={updateCopy.upgradeCommandLabel} command={installCommand} />
          <AgentCommandBlock label={updateCopy.verifyCommandLabel} command={verifyCommand} />

          <div className="rounded-2xl border border-white/10 bg-background/50 p-4 text-sm text-muted-foreground">
            {updateCopy.supportInstructions}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatHostMetricsFailure(
  failure: HostMetricsFailure | null | undefined,
  host: DockerHost | null,
) {
  if (!failure) return null;

  if (failure.unsupportedEndpoint) {
    const versionCopy = host?.agent_version
      ? `Installed agent: ${host.agent_version}. Current release: ${CURRENT_WATCHTOWER_AGENT_VERSION}.`
      : `Current release: ${CURRENT_WATCHTOWER_AGENT_VERSION}.`;
    return {
      title: "Metrics endpoint unavailable",
      description: `This host agent does not expose /metrics yet. Upgrade the agent and test the connection again. ${versionCopy}`,
    };
  }

  if (failure.code === "agent_timeout") {
    return {
      title: "Metrics request timed out",
      description: "The dashboard reached the host agent, but /metrics did not respond before the timeout window.",
    };
  }

  if (failure.code === "agent_connection_failed") {
    return {
      title: "Metrics connection failed",
      description: "The dashboard could not reach the host agent metrics endpoint. Check the tunnel, host URL, and agent process.",
    };
  }

  if (failure.malformedPayload) {
    return {
      title: "Malformed metrics payload",
      description: "The host agent returned a success response, but the metrics payload was incomplete or invalid.",
    };
  }

  return {
    title: "Host metrics unavailable",
    description: "The host agent did not return a usable metrics sample.",
  };
}

export function HostWorkspace() {
  const navigate = useNavigate();
  const { id: routeHostId } = useParams();
  const { organization: currentOrg } = useOrganization();
  const { toast } = useToast();
  const deleteHost = useDeleteDockerHost();
  const { data: hosts = [], isLoading, refetch } = useDockerHosts(currentOrg?.id);
  const [search, setSearch] = useState("");
  const [testing, setTesting] = useState(false);

  const filteredHosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return hosts;
    return hosts.filter((host) =>
      [host.name, host.host_url, host.connection_mode, host.status, host.os_info || ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [hosts, search]);

  const selectedHost = useMemo(() => {
    if (routeHostId) return hosts.find((host) => host.id === routeHostId) ?? null;
    return filteredHosts[0] ?? hosts[0] ?? null;
  }, [filteredHosts, hosts, routeHostId]);

  const selectedHostReadable = isReadableHostStatus(selectedHost?.status);
  const selectedHostDisconnected = isDisconnectedHostStatus(selectedHost?.status);

  const containersQuery = useHostContainers(selectedHostReadable ? selectedHost?.id : null);
  const metricsQuery = useHostMetricsHistory(selectedHostReadable ? selectedHost?.id : null, {
    enabled: selectedHostReadable,
    refetchInterval: 10000,
    maxDataPoints: 24,
  });
  const metricsFailureDisplay = formatHostMetricsFailure(metricsQuery.failure, selectedHost);
  const selectedPreviewMetrics = metricsQuery.latestPoint
    ? { cpu: metricsQuery.latestPoint.cpu, memory: metricsQuery.latestPoint.memory }
    : null;
  const metricsErrorMessage = metricsQuery.failure
    ? [
        metricsQuery.failure.message,
        metricsQuery.failure.upstreamStatus ? `Upstream status: ${metricsQuery.failure.upstreamStatus}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  const containers = Array.isArray(containersQuery.data) ? containersQuery.data : [];
  const runningCount = containers.filter((container: any) => container.State === "running").length;
  const agentOutdated = selectedHost?.agent_version ? isAgentVersionOutdated(selectedHost.agent_version) : false;
  const updateCopy = buildWatchtowerAgentUpdateCopy(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const showAgentUpdateCta = !!selectedHost && (!selectedHost.agent_version || agentOutdated);
  const addHostAction = currentOrg ? (
    <AddHostDialog
      orgId={currentOrg.id}
      trigger={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Host
        </Button>
      }
    />
  ) : null;

  const handleSelectHost = (hostId: string) => navigate(`/app/hosts/${hostId}`);

  const handleTest = async () => {
    if (!selectedHost) return;
    setTesting(true);
    try {
      const result = await dockerApi.ping(selectedHost.id);
      const latestVersion = result.latest_agent_version || CURRENT_WATCHTOWER_AGENT_VERSION;
      toast({
        title: result.ok ? "Connection successful" : "Connection failed",
        description: result.ok
          ? [
              `Docker ${result.docker_version || "detected"}.`,
              result.agent_version
                ? `Agent ${result.agent_version}${result.agent_update_available ? ` is behind ${latestVersion}` : ""}.`
                : result.agent_version_error
                  ? `Agent version not reported yet (${result.agent_version_error}). Current release is ${latestVersion}.`
                  : `Agent version not reported yet. Current release is ${latestVersion}.`,
            ].join(" ")
          : undefined,
      });
      await refetch();
      await metricsQuery.refetch();
    } catch (error: any) {
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedHost) return;
    if (!confirm(`Remove host "${selectedHost.name}"? This only removes it from the dashboard.`)) return;
    try {
      await deleteHost.mutateAsync(selectedHost.id);
      toast({ title: "Host removed" });
      await refetch();
      navigate("/app/hosts");
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Hosts"
        description={hosts.length > 0 ? `${hosts.length} host(s) configured` : "Connect Docker hosts to monitor"}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Hosts" }]}
        actions={currentOrg ? <AddHostDialog orgId={currentOrg.id} /> : undefined}
      />

      {hosts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Terminal className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Docker hosts connected</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Connect a Docker host via a lightweight agent or Cloudflare Tunnel. No open Docker ports needed.
          </p>
          {currentOrg && <AddHostDialog orgId={currentOrg.id} trigger={<Button>Connect Your First Host</Button>} />}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-white/5 px-5 py-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Host infrastructure</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Browse hosts</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hosts..." className="pl-9" />
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <div className="space-y-3 p-4">
                {filteredHosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">No hosts match your search.</div>
                ) : (
                  filteredHosts.map((host) => (
                    <HostCard
                      key={host.id}
                      host={host}
                      selected={host.id === selectedHost?.id}
                      previewMetrics={host.id === selectedHost?.id ? selectedPreviewMetrics : null}
                      onSelect={() => handleSelectHost(host.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {selectedHost ? (
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-primary/10 p-4">
                      <Server className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-4xl font-semibold tracking-tight">{selectedHost.name}</h2>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]", statusPill(selectedHost.status))}>
                          {selectedHost.status === "connected" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                          {selectedHost.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Endpoint: {selectedHost.host_url}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
                          {selectedHost.connection_mode === "cloudflare_tunnel" ? <CloudCog className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
                          {selectedHost.connection_mode === "cloudflare_tunnel" ? "Cloudflare tunnel" : "Agent connection"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
                          <Activity className="h-3.5 w-3.5" />
                          Last seen {formatLastSeen(selectedHost.last_seen_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" className="gap-2" onClick={handleTest} disabled={testing}>
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Test Connection
                    </Button>
                    {showAgentUpdateCta ? (
                      <AgentUpdateDialog
                        host={selectedHost}
                        trigger={
                          <Button variant="outline" className="gap-2">
                            <Terminal className="h-4 w-4" />
                            Update Agent
                          </Button>
                        }
                      />
                    ) : null}
                    {currentOrg && selectedHost ? (
                      <AddHostDialog
                        orgId={currentOrg.id}
                        host={selectedHost}
                        trigger={
                          <Button variant="outline" className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Edit Host
                          </Button>
                        }
                      />
                    ) : null}
                    <Button variant="destructive" className="gap-2" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4" />
                      Remove Host
                    </Button>
                    {addHostAction}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Running containers" value={`${runningCount}`} helper={`${containers.length} total`} icon={Box} />
                  <SummaryCard
                    label="Last seen"
                    value={selectedHost.last_seen_at ? new Date(selectedHost.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}
                    helper={
                      selectedHost.status === "connected"
                        ? "Heartbeat healthy"
                        : selectedHost.status === "stale"
                          ? "Heartbeat is stale"
                          : "Waiting for a successful probe"
                    }
                    icon={Activity}
                  />
                  <SummaryCard label="Operating system" value={selectedHost.os_info || "Unknown"} helper={`Docker ${selectedHost.docker_version || "pending"}`} icon={Server} />
                  <SummaryCard label="Agent version" value={selectedHost.agent_version || "Pending"} helper={agentOutdated ? `Update available: ${CURRENT_WATCHTOWER_AGENT_VERSION}` : `Current release: ${CURRENT_WATCHTOWER_AGENT_VERSION}`} icon={Terminal} />
                </div>
              </div>

              {selectedHost.status === "stale" && (
                <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  This host heartbeat is stale. The page will keep trying to read metrics and containers, but the data may be delayed or partially unavailable until the next successful health check.
                </div>
              )}

              {showAgentUpdateCta && (
                <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedHost.agent_version
                        ? updateCopy.outdatedSummary(selectedHost.agent_version, CURRENT_WATCHTOWER_AGENT_RELEASE.version)
                        : updateCopy.pendingSummary}
                    </p>
                    <p className="mt-1">
                      {updateCopy.repairSummary}
                    </p>
                  </div>
                  <AgentUpdateDialog
                    host={selectedHost}
                    trigger={<Button className="gap-2"><Terminal className="h-4 w-4" />Open Upgrade Steps</Button>}
                  />
                </div>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px),1fr]">
                {selectedHostDisconnected ? (
                  <EmptyState title="Host is disconnected" description="Reconnect the host or run a successful connection test to start collecting host metrics." />
                ) : metricsQuery.isLoading && metricsQuery.history.length === 0 ? (
                  <div className="glass-card min-h-[320px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : metricsQuery.failure && !metricsQuery.latestPoint ? (
                  <EmptyState
                    title={metricsFailureDisplay?.title || "Host metrics unavailable"}
                    description={metricsFailureDisplay?.description || "The host metrics probe failed before a usable sample was returned."}
                  />
                ) : metricsQuery.latestPoint ? (
                  <RingCard point={metricsQuery.latestPoint} />
                ) : (
                  <EmptyState title="No CPU metrics yet" description="The host is connected, but the agent has not returned a usable metrics sample yet." />
                )}

                <div className="grid gap-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    {selectedHostDisconnected ? (
                      <EmptyState title="Memory metrics unavailable" description="Memory panels appear after a connected host returns a metrics sample." />
                    ) : metricsQuery.isLoading && !metricsQuery.latestPoint ? (
                      <LoadingState />
                    ) : metricsQuery.failure && !metricsQuery.latestPoint ? (
                      <EmptyState
                        title={metricsFailureDisplay?.title || "Memory metrics unavailable"}
                        description={metricsFailureDisplay?.description || "The host metrics probe failed before memory data was returned."}
                      />
                    ) : metricsQuery.latestPoint ? (
                      <MeterCard
                        title="Memory usage"
                        value={formatBytes(metricsQuery.latestPoint.memoryUsed)}
                        helper={formatBytes(metricsQuery.latestPoint.memoryLimit)}
                        progress={metricsQuery.latestPoint.memory}
                        footer={`${metricsQuery.latestPoint.memory.toFixed(0)}% utilized`}
                      />
                    ) : (
                      <EmptyState title="Memory metrics unavailable" description="Waiting for a usable metrics sample from the host agent." />
                    )}

                    {selectedHostDisconnected ? (
                      <EmptyState title="Disk throughput unavailable" description="Disk throughput is shown only for connected hosts with live metrics." />
                    ) : metricsQuery.isLoading && !metricsQuery.latestPoint ? (
                      <LoadingState />
                    ) : metricsQuery.failure && !metricsQuery.latestPoint ? (
                      <EmptyState
                        title={metricsFailureDisplay?.title || "Disk throughput unavailable"}
                        description={metricsFailureDisplay?.description || "The host metrics probe failed before disk throughput data was returned."}
                      />
                    ) : metricsQuery.latestPoint ? (
                      <MeterCard
                        title="Disk throughput"
                        value={formatSpeed(metricsQuery.latestPoint.diskReadBytesPerSec)}
                        helper={formatSpeed(metricsQuery.latestPoint.diskWriteBytesPerSec)}
                        footer="Read / write throughput"
                      />
                    ) : (
                      <EmptyState title="Disk throughput unavailable" description="Waiting for a usable metrics sample from the host agent." />
                    )}
                  </div>

                  <div className="glass-card p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Network activity</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight">
                          {metricsQuery.latestPoint ? formatSpeed(metricsQuery.latestPoint.networkInBytesPerSec) : "Unavailable"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" />Inbound</span>
                        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-muted-foreground/60" />Outbound</span>
                      </div>
                    </div>
                    {selectedHostDisconnected ? (
                      <p className="text-sm text-muted-foreground">Connect this host to start rendering throughput history.</p>
                    ) : metricsQuery.isLoading && !metricsQuery.latestPoint ? (
                      <div className="flex h-36 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : metricsQuery.failure && !metricsQuery.latestPoint ? (
                      <p className="text-sm text-muted-foreground">
                        {metricsFailureDisplay?.description || "The host metrics probe failed before network history could be rendered."}
                      </p>
                    ) : (
                      <TrendBars history={metricsQuery.history} accessor={(point) => point.networkInBytesPerSec} />
                    )}
                  </div>
                </div>
              </div>

              {metricsErrorMessage && selectedHostReadable && (
                <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  {metricsErrorMessage}
                </div>
              )}

              <div className="glass-card overflow-hidden">
                <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Containers</p>
                    <h3 className="mt-1 text-lg font-semibold">Host workload</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Box className="h-4 w-4" />
                    {runningCount} running / {containers.length} total
                  </span>
                </div>
                {selectedHostDisconnected ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Host is not connected. Test the connection to fetch container data.</div>
                ) : containersQuery.isLoading ? (
                  <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : containers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No containers found on this host.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {containers.slice(0, 8).map((container: any) => (
                      <Link key={container.Id} to={`/app/containers/${container.Id?.substring(0, 12)}?host=${selectedHost.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{(container.Names?.[0] || container.Id?.substring(0, 12)).replace(/^\//, "")}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{container.Image}</p>
                        </div>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                          container.State === "running"
                            ? "bg-success/15 text-success"
                            : container.State === "exited"
                              ? "bg-muted text-muted-foreground"
                              : "bg-warning/15 text-warning",
                        )}>
                          {container.State}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-10 text-center text-muted-foreground">Select a host to view its details.</div>
          )}
        </div>
      )}
    </div>
  );
}
