import { formatDistanceToNowStrict } from "date-fns";
import {
  Box,
  Clock3,
  CloudCog,
  Activity,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { AgentUpdateDialog } from "@/components/hosts/AgentUpdateDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHostStatusAppearance, normalizeHostStatus } from "@/lib/host-health-state";
import type { DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION } from "@/lib/agent-version";

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  return formatDistanceToNowStrict(new Date(lastSeenAt), { addSuffix: true });
}

function formatUptime(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || seconds === null || seconds === undefined || seconds < 0) {
    return "Unavailable";
  }

  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
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

export interface HostDetailHeaderProps {
  selectedHost: DockerHost;
  containers: any[];
  runningCount: number;
  orgId: string | undefined;
  testing: boolean;
  liveRefreshPending: boolean;
  manualScanMode: boolean;
  scanQuotaExhausted: boolean;
  selectedHostAutoProbe: boolean;
  missingExtendedMetrics: boolean;
  uptimeSeconds: number | null | undefined;
  agentUpdateStatus: string;
  agentUpdateStatusCopy: { title: string; description: string };
  verificationReason: string | null;
  showAgentUpdateCta: boolean;
  onTest: () => void;
  onRefreshLiveData: () => void;
  onDelete: () => void;
}

export function HostDetailHeader({
  selectedHost,
  containers,
  runningCount,
  orgId,
  testing,
  liveRefreshPending,
  manualScanMode,
  scanQuotaExhausted,
  selectedHostAutoProbe,
  missingExtendedMetrics,
  uptimeSeconds,
  agentUpdateStatus,
  agentUpdateStatusCopy,
  verificationReason,
  showAgentUpdateCta,
  onTest,
  onRefreshLiveData,
  onDelete,
}: HostDetailHeaderProps) {
  const selectedHostAppearance = getHostStatusAppearance(selectedHost.status);
  const normalizedStatus = normalizeHostStatus(selectedHost.status);

  const uptimeHelper = (() => {
    if (uptimeSeconds !== null && uptimeSeconds !== undefined) {
      return "From current host metrics sample";
    }
    if (missingExtendedMetrics) {
      return `Update or reinstall the host agent to ${CURRENT_WATCHTOWER_AGENT_VERSION}`;
    }
    if (normalizedStatus === "connected") return "Waiting for uptime sample";
    if (normalizedStatus === "stale") return "Heartbeat is stale";
    return "Waiting for a successful probe";
  })();

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-4">
            <Server className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-semibold tracking-tight">{selectedHost.name}</h2>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]", selectedHostAppearance.pillClassName)}>
                {selectedHostAppearance.isOnlineIcon ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
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
          <Button variant="outline" className="gap-2" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Test Connection
          </Button>
          {manualScanMode ? (
            <Button variant="outline" className="gap-2" onClick={onRefreshLiveData} disabled={liveRefreshPending || !selectedHostAutoProbe || scanQuotaExhausted}>
              {liveRefreshPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Live Data
            </Button>
          ) : null}
          {showAgentUpdateCta ? (
            <AgentUpdateDialog
              host={selectedHost}
              status={agentUpdateStatus}
              statusCopy={agentUpdateStatusCopy}
              verificationReason={verificationReason}
              trigger={
                <Button variant="outline" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  Update Agent
                </Button>
              }
            />
          ) : null}
          {orgId && selectedHost ? (
            <AddHostDialog
              orgId={orgId}
              host={selectedHost}
              trigger={
                <Button variant="outline" className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit Host
                </Button>
              }
            />
          ) : null}
          <Button variant="destructive" className="gap-2" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Remove Host
          </Button>
          {orgId ? (
            <AddHostDialog
              orgId={orgId}
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Host
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Running containers" value={`${runningCount}`} helper={`${containers.length} total`} icon={Box} />
        <SummaryCard
          label="Uptime"
          value={formatUptime(uptimeSeconds)}
          helper={uptimeHelper}
          icon={Clock3}
        />
        <SummaryCard label="Operating system" value={selectedHost.os_info || "Unknown"} helper={`Docker ${selectedHost.docker_version || "pending"}`} icon={Server} />
        <SummaryCard
          label="Agent version"
          value={selectedHost.agent_version || "Pending"}
          helper={agentUpdateStatusCopy.description}
          icon={Terminal}
        />
      </div>
    </div>
  );
}
