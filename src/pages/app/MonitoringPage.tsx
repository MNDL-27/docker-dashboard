import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FleetResourceChart } from "@/components/dashboard/FleetResourceChart";
import { useFleetMetrics } from "@/hooks/useFleetMetrics";
import { useDockerHosts } from "@/hooks/useDocker";
import { useOrganization } from "@clerk/react";
import { Activity, Cpu, HardDrive, MemoryStick, Network, Server, ShieldAlert, Timer } from "lucide-react";
import { Link } from "react-router-dom";

type MetricTone = "success" | "warning" | "destructive" | "neutral";

const upcomingFeatures = [
  { icon: Cpu, title: "Host-level CPU & Memory", desc: "Side-by-side resource snapshots across your fleet with anomaly flags." },
  { icon: Activity, title: "Telemetry Correlation", desc: "Overlay deploys, incidents, and alerts directly on utilization charts." },
  { icon: Network, title: "Network & TCP Health", desc: "Packet loss, bandwidth shifts, and connection trends per host." },
  { icon: HardDrive, title: "Disk Forecasting", desc: "Predict storage pressure windows and trigger preventative alerts." },
];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond === null || bytesPerSecond === undefined || bytesPerSecond < 0) {
    return "--";
  }
  if (bytesPerSecond === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const exponent = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(1024)), units.length - 1);
  const value = bytesPerSecond / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value) || value === null || value === undefined) return "--";
  return `${value.toFixed(1)}%`;
}

function metricTone(value: number | null | undefined): MetricTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 90) return "destructive";
  if (value >= 80) return "warning";
  return "success";
}

function SignalCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Cpu;
  tone?: MetricTone;
}) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    neutral: "text-foreground",
  }[tone];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`mt-4 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function MonitoringPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(orgId, { filterByPlan: true });
  const { data: fleetMetrics = [], isLoading: metricsLoading, error: metricsError } = useFleetMetrics(orgId, 10000);

  const latestPoint = fleetMetrics.length > 0 ? fleetMetrics[fleetMetrics.length - 1] : null;
  const connectedHosts = hosts.filter((host) => host.status === "connected");
  const totalHosts = latestPoint?.totalHosts && latestPoint.totalHosts > 0 ? latestPoint.totalHosts : hosts.length;
  const reportingHosts = latestPoint?.reportingHosts ?? 0;
  const coveragePercent = totalHosts > 0 ? Math.round((reportingHosts / totalHosts) * 100) : 0;
  const lastSample = latestPoint
    ? new Date(latestPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";

  const telemetryLabel = metricsLoading
    ? "Collecting telemetry"
    : metricsError instanceof Error
      ? "Telemetry unavailable"
      : latestPoint
        ? latestPoint.isPartial
          ? "Partial telemetry"
          : "Telemetry live"
        : "Awaiting first sample";

  const telemetryBadgeClass = metricsLoading
    ? "border-white/10 bg-secondary text-muted-foreground"
    : metricsError instanceof Error
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : latestPoint
        ? latestPoint.isPartial
          ? "border-warning/20 bg-warning/10 text-warning"
          : "border-success/20 bg-success/10 text-success"
        : "border-white/10 bg-secondary text-muted-foreground";

  const cpuValue = latestPoint ? formatPercent(latestPoint.cpu) : "--";
  const cpuHelper = latestPoint
    ? `${latestPoint.usedCores.toFixed(2)} / ${latestPoint.totalCores.toFixed(2)} cores in use`
    : "No fleet sample yet";

  const memoryValue = latestPoint ? formatPercent(latestPoint.memory) : "--";
  const memoryHelper = latestPoint
    ? `${formatBytes(latestPoint.memoryUsed)} / ${formatBytes(latestPoint.memoryLimit)}`
    : "No fleet sample yet";

  const networkValue = latestPoint
    ? `${formatSpeed(latestPoint.networkInBytesPerSec)} / ${formatSpeed(latestPoint.networkOutBytesPerSec)}`
    : "-- / --";
  const networkHelper = latestPoint ? "Inbound / outbound throughput" : "Awaiting network telemetry";

  const diskValue = latestPoint
    ? `${formatSpeed(latestPoint.diskReadBytesPerSec)} / ${formatSpeed(latestPoint.diskWriteBytesPerSec)}`
    : "-- / --";
  const diskHelper = latestPoint ? "Read / write throughput" : "Awaiting disk telemetry";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Resource utilization and performance telemetry"
        breadcrumbs={[{ label: "Observability" }, { label: "Monitoring" }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
              Preview
            </Badge>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/app/alerts">
                <ShieldAlert className="h-4 w-4" />
                Open Alerts
              </Link>
            </Button>
          </div>
        }
      />

      {!hostsLoading && hosts.length === 0 ? (
        <div className="glass-card p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No hosts connected</h3>
              <p className="text-sm text-muted-foreground">Connect a Docker host to start collecting telemetry.</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/app/hosts">Connect a host</Link>
          </Button>
        </div>
      ) : null}

      {metricsError instanceof Error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {metricsError.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          label="Fleet CPU"
          value={cpuValue}
          helper={cpuHelper}
          icon={Cpu}
          tone={metricTone(latestPoint?.cpu)}
        />
        <SignalCard
          label="Fleet Memory"
          value={memoryValue}
          helper={memoryHelper}
          icon={MemoryStick}
          tone={metricTone(latestPoint?.memory)}
        />
        <SignalCard
          label="Network I/O"
          value={networkValue}
          helper={networkHelper}
          icon={Network}
        />
        <SignalCard
          label="Disk I/O"
          value={diskValue}
          helper={diskHelper}
          icon={HardDrive}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr),minmax(0,0.85fr)]">
        <div className="min-h-[360px]">
          <FleetResourceChart orgId={orgId} className="h-full" />
        </div>
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold tracking-tight">Telemetry coverage</h3>
              </div>
              <Badge variant="outline" className={`text-[10px] uppercase tracking-widest ${telemetryBadgeClass}`}>
                {telemetryLabel}
              </Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold tracking-tight">{coveragePercent}%</div>
                <p className="text-xs text-muted-foreground">
                  {reportingHosts} / {totalHosts || 0} hosts reporting
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Last sample {lastSample}</div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, Math.min(100, coveragePercent))}%` }}
              />
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">Alert thresholds</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { label: "CPU saturation", value: "85% for 5 minutes", status: "Draft" },
                { label: "Memory pressure", value: "90% for 3 minutes", status: "Draft" },
                { label: "Disk throughput", value: "Spike over baseline", status: "Planned" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</div>
                    <div className="text-sm text-foreground">{item.value}</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {item.status}
                  </span>
                </div>
              ))}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/app/alerts">Configure alert rules</Link>
              </Button>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">Telemetry cadence</h3>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Refresh interval</span>
                <span className="text-foreground">10 seconds</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Connected hosts</span>
                <span className="text-foreground">{connectedHosts.length} active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Data retention</span>
                <span className="text-foreground">Rolling 24h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Monitoring roadmap</h3>
            <p className="text-xs text-muted-foreground">Preview of the next monitoring surfaces landing soon.</p>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
            Roadmap
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingFeatures.map((feature) => (
            <div key={feature.title} className="glass-card-interactive p-4">
              <div className="rounded-lg bg-primary/10 p-2 w-fit">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <h4 className="mt-3 text-sm font-semibold">{feature.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
