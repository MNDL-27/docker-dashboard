import { Loader2 } from "lucide-react";

import { AgentUpdateDialog } from "@/components/hosts/AgentUpdateDialog";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeHostStatus } from "@/lib/host-health-state";
import type { HostMetricsDisk, HostMetricsFailure, HostMetricsPoint } from "@/hooks/useHostMetrics";
import type { DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION } from "@/lib/agent-version";

// ---------------------------------------------------------------------------
// Shared formatting helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function RingCard({ point }: { point: HostMetricsPoint }) {
  const value = Math.max(0, Math.min(100, point.cpu));
  const colorVar = value >= 90 ? "var(--destructive)" : value >= 70 ? "var(--warning)" : "var(--primary)";

  return (
    <div className="glass-card min-h-[260px] p-5 flex flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">CPU usage</p>
      </div>
      <div
        className="relative flex h-44 w-44 items-center justify-center rounded-full transition-all duration-500"
        style={{ background: `conic-gradient(hsl(${colorVar}) ${value}%, rgba(255,255,255,0.06) ${value}% 100%)` }}
      >
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-background/95">
          <span className="text-4xl font-semibold tracking-tight">{value.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {point.usedCores.toFixed(2)} / {point.totalCores.toFixed(2)} cores
      </p>
    </div>
  );
}

function ContainerSummaryCard({
  total,
  running,
  loading,
  disconnected,
  paused,
}: {
  total: number;
  running: number;
  loading: boolean;
  disconnected: boolean;
  paused?: boolean;
}) {
  const stopped = Math.max(0, total - running);
  const showStoppedCount = !disconnected && !paused && !loading;

  return (
    <div className="glass-card min-h-[220px] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Containers</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Host workload</h3>
        </div>
      </div>

      {disconnected ? (
        <p className="text-sm text-muted-foreground">Reconnect the host to load container counts.</p>
      ) : paused && total === 0 ? (
        <p className="text-sm text-muted-foreground">Container counts are paused while the host heartbeat is stale.</p>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Running</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{running}</p>
          </div>
        </div>
      )}

      {showStoppedCount ? (
        <p className="text-sm text-muted-foreground">{stopped} stopped containers on this host.</p>
      ) : null}
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

function DiskUsageCard({ disk }: { disk: HostMetricsDisk }) {
  const progress = disk.totalBytes > 0 ? Math.max(0, Math.min(100, (disk.usedBytes / disk.totalBytes) * 100)) : 0;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Disk usage ({disk.device})</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {formatBytes(disk.usedBytes)} <span className="text-muted-foreground">/ {formatBytes(disk.totalBytes)}</span>
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">{disk.mount}</p>
      </div>
      <div className="space-y-2">
        <div className="h-3 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% utilized</p>
      </div>
      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>Read: <span className="text-foreground">{formatSpeed(disk.readBytesPerSec)}</span></span>
        <span>Write: <span className="text-foreground">{formatSpeed(disk.writeBytesPerSec)}</span></span>
      </div>
    </div>
  );
}

function TrendBars({
  history,
  accessor,
  secondaryAccessor,
  maxBars = 24,
}: {
  history: HostMetricsPoint[];
  accessor: (point: HostMetricsPoint) => number | null;
  secondaryAccessor?: (point: HostMetricsPoint) => number | null;
  maxBars?: number;
}) {
  const totals = history.map(p => (accessor(p) ?? 0) + (secondaryAccessor?.(p) ?? 0));
  const maxValue = totals.length > 0 ? Math.max(...totals, 1) : 1;
  const hasData = history.length > 0;

  if (!hasData) {
    return (
      <div className="flex h-36 items-end gap-2">
        {Array.from({ length: maxBars }).map((_, index) => {
          const height = 18 + (index % 5) * 10;
          return (
            <div
              key={`placeholder-${index}`}
              className="flex-1 rounded-t-full bg-primary/20 transition-all"
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
    );
  }

  const emptySlots = Math.max(0, maxBars - history.length);
  const dataBars = history.slice(-maxBars);

  return (
    <div className="flex h-36 items-end gap-2">
      {Array.from({ length: emptySlots }).map((_, index) => (
        <div key={`empty-${index}`} className="flex-1 rounded-t-full bg-white/5 transition-all" style={{ height: '4px' }} />
      ))}
      {dataBars.map((point) => {
        const valPrimary = accessor(point) ?? 0;
        const valSecondary = secondaryAccessor?.(point) ?? 0;
        const total = valPrimary + valSecondary;

        const primaryHeight = total === 0 ? 2 : Math.max(2, Math.round((valPrimary / maxValue) * 100));
        const secondaryHeight = total === 0 ? 0 : Math.round((valSecondary / maxValue) * 100);

        return (
          <div
            key={point.timestamp}
            className="flex-1 flex flex-col justify-end gap-[1px]"
            style={{ height: `${Math.max(4, primaryHeight + secondaryHeight)}%` }}
          >
            {valSecondary > 0 && (
              <div
                className="w-full rounded-t-full bg-muted-foreground/40 transition-all duration-500"
                style={{ height: `${(secondaryHeight / (primaryHeight + secondaryHeight)) * 100}%` }}
              />
            )}
            <div
              className={cn(
                "w-full transition-all duration-500",
                valSecondary > 0 ? "rounded-b-sm" : "rounded-t-full",
                "bg-primary/60"
              )}
              style={{ height: `${(primaryHeight / (primaryHeight + secondaryHeight)) * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics status helpers (resolve which panel variant to render)
// ---------------------------------------------------------------------------

interface MetricsState {
  disconnected: boolean;
  stale: boolean;
  isLoading: boolean;
  hasLatestPoint: boolean;
  hasFailure: boolean;
  hasHistory: boolean;
}

type MetricsVariant = "disconnected" | "loading" | "failure" | "stale" | "data" | "empty";

function resolveMetricsVariant(state: MetricsState): MetricsVariant {
  if (state.disconnected) return "disconnected";
  if (state.isLoading && !state.hasLatestPoint) return "loading";
  if (state.hasFailure && !state.hasLatestPoint) return "failure";
  if (state.hasLatestPoint) return "data";
  if (state.stale) return "stale";
  return "empty";
}

// ---------------------------------------------------------------------------
// Main grid component
// ---------------------------------------------------------------------------

export interface HostMetricsGridProps {
  selectedHost: DockerHost;
  metricsQuery: {
    isLoading: boolean;
    isFetching: boolean;
    latestPoint: HostMetricsPoint | undefined;
    history: HostMetricsPoint[];
    failure: HostMetricsFailure | null;
  };
  containersQuery: {
    isLoading: boolean;
    isFetching: boolean;
    data: any;
    error: unknown;
  };
  containers: any[];
  runningCount: number;
  metricsFailureDisplay: { title: string; description: string } | null;
  missingExtendedMetrics: boolean;
  selectedHostDisconnected: boolean;
  selectedHostStale: boolean;
  agentUpdateStatus: string;
  agentUpdateStatusCopy: { title: string; description: string };
  verificationReason: string | null;
  showAgentUpdateCta: boolean;
}

export function HostMetricsGrid({
  selectedHost,
  metricsQuery,
  containersQuery,
  containers,
  runningCount,
  metricsFailureDisplay,
  missingExtendedMetrics,
  selectedHostDisconnected,
  selectedHostStale,
  agentUpdateStatus,
  agentUpdateStatusCopy,
  verificationReason,
  showAgentUpdateCta,
}: HostMetricsGridProps) {
  const metricsState: MetricsState = {
    disconnected: selectedHostDisconnected,
    stale: selectedHostStale,
    isLoading: metricsQuery.isLoading,
    hasLatestPoint: !!metricsQuery.latestPoint,
    hasFailure: !!metricsQuery.failure,
    hasHistory: metricsQuery.history.length > 0,
  };

  const variant = resolveMetricsVariant(metricsState);
  const failureTitle = metricsFailureDisplay?.title || "Host metrics unavailable";
  const failureDescription = metricsFailureDisplay?.description || "The host metrics probe failed before a usable sample was returned.";

  const missingHint = missingExtendedMetrics
    ? `Update or repair the host agent to restore the full metrics sample.`
    : "Waiting for a usable metrics sample from the host agent.";

  const diskMissingHint = missingExtendedMetrics
    ? `This host agent is not reporting per-disk usage yet. Update or repair the agent to ${CURRENT_WATCHTOWER_AGENT_VERSION}, then Verify.`
    : "Waiting for a usable per-disk metrics sample from the host agent.";

  return (
    <>
      {/* Agent update CTA banner */}
      {showAgentUpdateCta && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium text-foreground">{agentUpdateStatusCopy.title}</p>
            <p className="mt-1">{agentUpdateStatusCopy.description}</p>
          </div>
          <AgentUpdateDialog
            host={selectedHost}
            status={agentUpdateStatus}
            statusCopy={agentUpdateStatusCopy}
            verificationReason={verificationReason}
            trigger={
              <Button className="gap-2">
                <Terminal className="h-4 w-4" />
                {agentUpdateStatus === "verification_required" ? "Open Verification Steps" : "Open Update Steps"}
              </Button>
            }
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px),1fr]">
        {/* Left column: CPU ring + container summary */}
        <div className="grid gap-6">
          <CpuPanel variant={variant} latestPoint={metricsQuery.latestPoint} failureTitle={failureTitle} failureDescription={failureDescription} />
          <ContainerSummaryCard
            total={containers.length}
            running={runningCount}
            loading={containersQuery.isLoading}
            disconnected={selectedHostDisconnected}
            paused={selectedHostStale}
          />
        </div>

        {/* Right column: memory, disk, network */}
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <MemoryPanel variant={variant} latestPoint={metricsQuery.latestPoint} failureTitle={failureTitle} failureDescription={failureDescription} missingHint={missingHint} />
            <DiskPanel variant={variant} latestPoint={metricsQuery.latestPoint} failureTitle={failureTitle} failureDescription={failureDescription} diskMissingHint={diskMissingHint} />
          </div>
          <NetworkPanel
            variant={variant}
            latestPoint={metricsQuery.latestPoint}
            history={metricsQuery.history}
            failureDescription={failureDescription}
            selectedHostDisconnected={selectedHostDisconnected}
            selectedHostStale={selectedHostStale}
            metricsIsLoading={metricsQuery.isLoading}
            hasFailure={!!metricsQuery.failure}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel sub-components (one per metrics section)
// ---------------------------------------------------------------------------

function CpuPanel({
  variant,
  latestPoint,
  failureTitle,
  failureDescription,
}: {
  variant: MetricsVariant;
  latestPoint: HostMetricsPoint | undefined;
  failureTitle: string;
  failureDescription: string;
}) {
  switch (variant) {
    case "disconnected":
      return <EmptyState title="Host is disconnected" description="Reconnect the host or run a successful connection test to start collecting host metrics." />;
    case "loading":
      return <div className="glass-card min-h-[260px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    case "failure":
      return <EmptyState title={failureTitle} description={failureDescription} />;
    case "data":
      return <RingCard point={latestPoint!} />;
    case "stale":
      return <EmptyState title="Metrics paused" description="Automatic metrics collection is paused while the host heartbeat is stale. Data will resume after a successful health check or connection test." />;
    default:
      return <EmptyState title="No CPU metrics yet" description="The host is connected, but the agent has not returned a usable metrics sample yet." />;
  }
}

function MemoryPanel({
  variant,
  latestPoint,
  failureTitle,
  failureDescription,
  missingHint,
}: {
  variant: MetricsVariant;
  latestPoint: HostMetricsPoint | undefined;
  failureTitle: string;
  failureDescription: string;
  missingHint: string;
}) {
  switch (variant) {
    case "disconnected":
      return <EmptyState title="Memory metrics unavailable" description="Memory panels appear after a connected host returns a metrics sample." />;
    case "loading":
      return <LoadingState />;
    case "failure":
      return <EmptyState title={failureTitle || "Memory metrics unavailable"} description={failureDescription || "The host metrics probe failed before memory data was returned."} />;
    case "data":
      return (
        <MeterCard
          title="Memory usage"
          value={formatBytes(latestPoint!.memoryUsed)}
          helper={formatBytes(latestPoint!.memoryLimit)}
          progress={latestPoint!.memory}
          footer={`${latestPoint!.memory.toFixed(0)}% utilized`}
        />
      );
    case "stale":
      return <EmptyState title="Memory metrics paused" description="Automatic metrics collection is paused while the host heartbeat is stale." />;
    default:
      return <EmptyState title="Memory metrics unavailable" description={missingHint} />;
  }
}

function DiskPanel({
  variant,
  latestPoint,
  failureTitle,
  failureDescription,
  diskMissingHint,
}: {
  variant: MetricsVariant;
  latestPoint: HostMetricsPoint | undefined;
  failureTitle: string;
  failureDescription: string;
  diskMissingHint: string;
}) {
  switch (variant) {
    case "disconnected":
      return <EmptyState title="Disk usage unavailable" description="Disk usage is shown only for connected hosts with live metrics." />;
    case "loading":
      return <LoadingState />;
    case "failure":
      return <EmptyState title={failureTitle || "Disk usage unavailable"} description={failureDescription || "The host metrics probe failed before disk usage data was returned."} />;
    case "data":
      if (latestPoint?.disks.length) {
        return (
          <>
            {latestPoint.disks.map((disk) => (
              <DiskUsageCard key={`${disk.device}-${disk.mount}`} disk={disk} />
            ))}
          </>
        );
      }
      return <EmptyState title="Disk usage unavailable" description={diskMissingHint} />;
    case "stale":
      return <EmptyState title="Disk metrics paused" description="Automatic metrics collection is paused while the host heartbeat is stale." />;
    default:
      return <EmptyState title="Disk usage unavailable" description={diskMissingHint} />;
  }
}

function NetworkPanel({
  variant,
  latestPoint,
  history,
  failureDescription,
  selectedHostDisconnected,
  selectedHostStale,
  metricsIsLoading,
  hasFailure,
}: {
  variant: MetricsVariant;
  latestPoint: HostMetricsPoint | undefined;
  history: HostMetricsPoint[];
  failureDescription: string;
  selectedHostDisconnected: boolean;
  selectedHostStale: boolean;
  metricsIsLoading: boolean;
  hasFailure: boolean;
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Network activity</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">Inbound</p>
              <p className="text-3xl font-semibold tracking-tight">
                {latestPoint ? formatSpeed(latestPoint.networkInBytesPerSec) : "Unavailable"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outbound</p>
              <p className="text-3xl font-semibold tracking-tight">
                {latestPoint ? formatSpeed(latestPoint.networkOutBytesPerSec) : "Unavailable"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" />Inbound</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-muted-foreground/60" />Outbound</span>
          </div>
          {latestPoint?.networkMonthlyTotal !== undefined ? (
            <p className="text-sm font-medium text-muted-foreground">
              Monthly usage: <span className="text-foreground">{formatBytes(latestPoint.networkMonthlyTotal)}</span>
            </p>
          ) : latestPoint ? (
            <p className="text-sm font-medium text-muted-foreground">
              Total: <span className="text-foreground">{formatSpeed((latestPoint.networkInBytesPerSec || 0) + (latestPoint.networkOutBytesPerSec || 0))}</span>
            </p>
          ) : null}
        </div>
      </div>
      <NetworkTrendSection
        selectedHostDisconnected={selectedHostDisconnected}
        selectedHostStale={selectedHostStale}
        metricsIsLoading={metricsIsLoading}
        hasLatestPoint={!!latestPoint}
        hasFailure={hasFailure}
        hasHistory={history.length > 0}
        history={history}
        failureDescription={failureDescription}
      />
    </div>
  );
}

function NetworkTrendSection({
  selectedHostDisconnected,
  selectedHostStale,
  metricsIsLoading,
  hasLatestPoint,
  hasFailure,
  hasHistory,
  history,
  failureDescription,
}: {
  selectedHostDisconnected: boolean;
  selectedHostStale: boolean;
  metricsIsLoading: boolean;
  hasLatestPoint: boolean;
  hasFailure: boolean;
  hasHistory: boolean;
  history: HostMetricsPoint[];
  failureDescription: string;
}) {
  if (selectedHostDisconnected) {
    return <p className="text-sm text-muted-foreground">Connect this host to start rendering throughput history.</p>;
  }
  if (metricsIsLoading && !hasLatestPoint) {
    return (
      <div className="flex h-36 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (hasFailure && !hasLatestPoint) {
    return (
      <div className="flex h-36 items-center justify-center">
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {failureDescription || "Network throughput is unavailable while the metrics probe cannot reach this host."}
        </p>
      </div>
    );
  }
  if (selectedHostStale && !hasHistory) {
    return <p className="text-sm text-muted-foreground">Network throughput history is paused while the host heartbeat is stale.</p>;
  }
  return (
    <TrendBars
      history={history}
      accessor={(point) => point.networkInBytesPerSec}
      secondaryAccessor={(point) => point.networkOutBytesPerSec}
    />
  );
}
