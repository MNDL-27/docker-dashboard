import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HostDetailHeader } from "@/components/hosts/HostDetailHeader";
import { HostMetricsGrid } from "@/components/hosts/HostMetricsGrid";
import { normalizeHostStatus } from "@/lib/host-health-state";
import { sanitizeConnectionError } from "@/lib/error-sanitizer";
import type { useHostContainers } from "@/hooks/useDocker";
import type { useHostMetricsHistory } from "@/hooks/useHostMetrics";
import type { DockerHost } from "@/types/database";

interface SelectedHostViewProps {
  selectedHost: DockerHost;
  containers: unknown[];
  runningCount: number;
  orgId: string | undefined;
  testing: boolean;
  liveRefreshPending: boolean;
  selectedHostAutoProbe: boolean;
  selectedHostDisconnected: boolean;
  selectedHostStale: boolean;
  selectedHostReadable: boolean;
  missingExtendedMetrics: boolean;
  metricsQuery: ReturnType<typeof useHostMetricsHistory>;
  containersQuery: ReturnType<typeof useHostContainers>;
  metricsFailureDisplay: { title: string; description: string } | null;
  metricsErrorMessage: string | null;
  agentUpdateStatus: string;
  agentUpdateStatusCopy: { title: string; description: string };
  verificationReason: string | null;
  showAgentUpdateCta: boolean;
  isInfrastructureVisible: boolean;
  onShowSidebar: () => void;
  onTest: () => void;
  onRefreshLiveData: () => void;
  onDelete: () => void;
}

export function SelectedHostView({
  selectedHost,
  containers,
  runningCount,
  orgId,
  testing,
  liveRefreshPending,
  selectedHostAutoProbe,
  selectedHostDisconnected,
  selectedHostStale,
  selectedHostReadable,
  missingExtendedMetrics,
  metricsQuery,
  containersQuery,
  metricsFailureDisplay,
  metricsErrorMessage,
  agentUpdateStatus,
  agentUpdateStatusCopy,
  verificationReason,
  showAgentUpdateCta,
  isInfrastructureVisible,
  onShowSidebar,
  onTest,
  onRefreshLiveData,
  onDelete,
}: SelectedHostViewProps) {
  return (
    <div className="space-y-6">
      {!isInfrastructureVisible ? (
        <div className="flex justify-start">
          <Button type="button" variant="outline" className="gap-2" onClick={onShowSidebar}>
            <PanelLeftOpen className="h-4 w-4" />
            Show Host Infrastructure
          </Button>
        </div>
      ) : null}

      <HostDetailHeader
        selectedHost={selectedHost}
        containers={containers}
        runningCount={runningCount}
        orgId={orgId}
        testing={testing}
        liveRefreshPending={liveRefreshPending}
        selectedHostAutoProbe={selectedHostAutoProbe}
        missingExtendedMetrics={missingExtendedMetrics}
        uptimeSeconds={metricsQuery.latestPoint?.uptimeSeconds}
        agentUpdateStatus={agentUpdateStatus}
        agentUpdateStatusCopy={agentUpdateStatusCopy}
        verificationReason={verificationReason}
        showAgentUpdateCta={showAgentUpdateCta}
        onTest={onTest}
        onRefreshLiveData={onRefreshLiveData}
        onDelete={onDelete}
      />

      {normalizeHostStatus(selectedHost.status) === "stale" && (
        <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          This host heartbeat is stale. Automatic metrics and container reads are paused until the next successful health check or a manual connection test.
        </div>
      )}

      {containersQuery.error instanceof Error ? (() => {
        const sanitized = sanitizeConnectionError(containersQuery.error);
        return (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 space-y-1">
            <p className="text-sm font-medium text-destructive">{sanitized.title}</p>
            <p className="text-sm text-muted-foreground">{sanitized.description}</p>
          </div>
        );
      })() : null}

      <HostMetricsGrid
        selectedHost={selectedHost}
        metricsQuery={metricsQuery}
        containersQuery={containersQuery}
        containers={containers}
        runningCount={runningCount}
        metricsFailureDisplay={metricsFailureDisplay}
        missingExtendedMetrics={missingExtendedMetrics}
        selectedHostDisconnected={selectedHostDisconnected}
        selectedHostStale={selectedHostStale}
        agentUpdateStatus={agentUpdateStatus}
        agentUpdateStatusCopy={agentUpdateStatusCopy}
        verificationReason={verificationReason}
        showAgentUpdateCta={showAgentUpdateCta}
      />

      {metricsErrorMessage && selectedHostReadable && (
        <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          {metricsErrorMessage}
        </div>
      )}
    </div>
  );
}
