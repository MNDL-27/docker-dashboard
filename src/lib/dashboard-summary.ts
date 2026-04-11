import type { DockerHost } from "@/types/database";
import type { AlertItem, DashboardContainerSummary } from "@/components/dashboard/dashboard-types";

export interface DashboardStats {
  hostsCount: number;
  connectedCount: number;
  unhealthyCount: number;
  containersCount: number;
  runningCount: number;
  stoppedCount: number;
  alerts: AlertItem[];
  containers: DashboardContainerSummary[];
}

type RawContainer = Record<string, unknown>;

function isRecord(value: unknown): value is RawContainer {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

export function normalizeDashboardContainers(containers: unknown): DashboardContainerSummary[] {
  if (!Array.isArray(containers)) {
    return [];
  }

  return containers.flatMap((container) => {
    if (!isRecord(container)) {
      return [];
    }

    const id = typeof container.Id === "string" ? container.Id : null;
    if (!id) {
      return [];
    }

    return [
      {
        Id: id,
        State: typeof container.State === "string" ? container.State : "unknown",
        Names: toStringArray(container.Names),
        Image: typeof container.Image === "string" ? container.Image : undefined,
      },
    ];
  });
}

export function buildDashboardStats(hosts: DockerHost[], containers: unknown): DashboardStats {
  const normalizedContainers = normalizeDashboardContainers(containers);
  const connectedHosts = hosts.filter((host) => host.status === "connected");
  const unhealthyHosts = hosts.filter((host) => host.status === "error" || host.status === "disconnected");
  const runningContainers = normalizedContainers.filter((container) => container.State === "running");
  const stoppedContainers = normalizedContainers.filter(
    (container) => container.State !== "running" && container.State !== "exited",
  );

  const alerts: AlertItem[] = [
    ...unhealthyHosts.map((host) => ({
      id: `host-${host.id}`,
      type: "host" as const,
      severity: "error" as const,
      title: "Host Disconnected",
      description: `Host "${host.name}" is unresponsive. Check agent connectivity.`,
      timestamp: host.last_seen_at ? "Seen recently" : "Never seen",
    })),
    ...normalizedContainers
      .filter((container) => container.State === "restarting")
      .map((container) => ({
        id: `cont-${container.Id}`,
        type: "container" as const,
        severity: "warning" as const,
        title: "Container Restart Loop",
        description: `${container.Names?.[0]?.replace("/", "") || "Container"} is restarting frequently.`,
        timestamp: "Just now",
      })),
  ];

  return {
    hostsCount: hosts.length,
    connectedCount: connectedHosts.length,
    unhealthyCount: unhealthyHosts.length,
    containersCount: normalizedContainers.length,
    runningCount: runningContainers.length,
    stoppedCount: stoppedContainers.length,
    alerts,
    containers: normalizedContainers,
  };
}

