import type { HostMetricsFailure } from "@/hooks/useHostMetrics";
import type { dockerApi } from "@/services/docker-api";
import type { DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION } from "@/lib/agent-version";
import {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  getWatchtowerAgentUpdateStatus,
  getWatchtowerAgentUpdateStatusCopy,
} from "@/lib/agent-release";
export { buildAddHostDisabledReason } from "@/lib/host-limits";

export type PingResult = Awaited<ReturnType<typeof dockerApi.ping>>;

export function buildAgentVersionLine(
  result: PingResult,
  latestVersion: string,
  statusDescription: string | null,
): string {
  const fallback = statusDescription || `Current release is ${latestVersion}.`;
  if (result.agent_version) {
    const updateCopy = result.agent_update_available
      ? `Update available: ${latestVersion}.`
      : `Current release is ${latestVersion}.`;
    return `Agent ${result.agent_version}. ${statusDescription || updateCopy}`;
  }
  if (result.agent_version_error) {
    return `Agent version not reported yet (${result.agent_version_error}). ${fallback}`;
  }
  return `Agent version not reported yet. ${fallback}`;
}

export function buildPingToastDescription(result: PingResult): string | undefined {
  if (!result.ok) return undefined;
  const latestVersion = result.latest_agent_version || CURRENT_WATCHTOWER_AGENT_VERSION;
  const statusDescription = result.agent_update_status
    ? getWatchtowerAgentUpdateStatusCopy(result.agent_update_status, CURRENT_WATCHTOWER_AGENT_RELEASE)?.description ?? null
    : null;
  const versionLine = buildAgentVersionLine(result, latestVersion, statusDescription);
  return [`Docker ${result.docker_version || "detected"}.`, versionLine].join(" ");
}

export function isRunningContainer(value: unknown): value is { State?: string } {
  return typeof value === "object" && value !== null && (value as { State?: unknown }).State === "running";
}

export function buildMetricsErrorMessage(failure: HostMetricsFailure | null | undefined): string | null {
  if (!failure) return null;
  const parts = [failure.message];
  if (failure.upstreamStatus) parts.push(`Upstream status: ${failure.upstreamStatus}.`);
  return parts.filter(Boolean).join(" ");
}

export function resolveAgentUpdateCopy(status: ReturnType<typeof getWatchtowerAgentUpdateStatus>) {
  return (
    getWatchtowerAgentUpdateStatusCopy(status, CURRENT_WATCHTOWER_AGENT_RELEASE) ??
    getWatchtowerAgentUpdateStatusCopy("pending", CURRENT_WATCHTOWER_AGENT_RELEASE)
  );
}

export function agentVerificationReason(
  failure: HostMetricsFailure | null | undefined,
  missingExtendedMetrics: boolean,
): string | null {
  if (failure?.unsupportedEndpoint) {
    return "This host agent does not expose /metrics yet. Run Preflight, Update, then Verify.";
  }
  if (failure?.code === "agent_timeout") {
    return "The agent responded too slowly. Check the local service, then use Troubleshoot / Repair.";
  }
  if (failure?.code === "agent_connection_failed") {
    return "The dashboard could not reach the host agent. Confirm the host URL, tunnel, and local service.";
  }
  if (failure?.code === "docker_socket_unavailable") {
    return "The agent is reachable, but it cannot reach Docker. Run Troubleshoot / Repair to restore Docker socket access.";
  }
  if (failure?.malformedPayload) {
    return "The host returned a malformed metrics sample. Update the agent, then Verify the local service.";
  }
  if (missingExtendedMetrics) {
    return "The current agent version is installed, but uptime and per-disk fields are still missing. Run Verify or Troubleshoot / Repair.";
  }
  return null;
}

export function formatHostMetricsFailure(
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
  if (failure.code === "docker_socket_unavailable") {
    return {
      title: "Docker socket inaccessible",
      description: "The agent is reachable, but the service cannot access Docker. Run Troubleshoot / Repair so systemd grants the agent Docker socket group access.",
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
