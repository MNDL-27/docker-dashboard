import { describe, expect, it } from "vitest";
import type { DockerHost } from "@/types/database";
import { buildDashboardStats, normalizeDashboardContainers } from "@/lib/dashboard-summary";

const hosts: DockerHost[] = [
  {
    id: "host-1",
    organization_id: "org-1",
    name: "primary",
    host_url: "https://example.com",
    connection_mode: "agent",
    docker_socket_path: "/var/run/docker.sock",
    status: "connected",
    docker_version: null,
    agent_version: null,
    os_info: "Ubuntu",
    last_seen_at: "2026-04-12T00:00:00.000Z",
    consecutive_failures: 0,
    last_error: null,
    created_by: "user-1",
    created_at: "2026-04-12T00:00:00.000Z",
    updated_at: "2026-04-12T00:00:00.000Z",
  },
  {
    id: "host-2",
    organization_id: "org-1",
    name: "edge",
    host_url: "https://example.org",
    connection_mode: "cloudflare_tunnel",
    docker_socket_path: "/var/run/docker.sock",
    status: "disconnected",
    docker_version: null,
    agent_version: null,
    os_info: null,
    last_seen_at: null,
    consecutive_failures: 3,
    last_error: "timeout",
    created_by: "user-1",
    created_at: "2026-04-12T00:00:00.000Z",
    updated_at: "2026-04-12T00:00:00.000Z",
  },
];

describe("normalizeDashboardContainers", () => {
  it("drops invalid containers and keeps the container summary shape", () => {
    const normalized = normalizeDashboardContainers([
      { Id: "abc", State: "running", Names: ["/web"], Image: "nginx:latest" },
      { State: "exited" },
      null,
    ]);

    expect(normalized).toEqual([
      { Id: "abc", State: "running", Names: ["/web"], Image: "nginx:latest" },
    ]);
  });
});

describe("buildDashboardStats", () => {
  it("derives host and container counts and alerts", () => {
    const stats = buildDashboardStats(hosts, [
      { Id: "cont-1", State: "running", Names: ["/api"], Image: "api:latest" },
      { Id: "cont-2", State: "restarting", Names: ["/worker"], Image: "worker:latest" },
      { Id: "cont-3", State: "paused", Names: ["/proxy"], Image: "proxy:latest" },
    ]);

    expect(stats.hostsCount).toBe(2);
    expect(stats.connectedCount).toBe(1);
    expect(stats.unhealthyCount).toBe(1);
    expect(stats.containersCount).toBe(3);
    expect(stats.runningCount).toBe(1);
    expect(stats.stoppedCount).toBe(2);
    expect(stats.alerts).toHaveLength(2);
    expect(stats.alerts[0]).toMatchObject({
      id: "host-host-2",
      type: "host",
      severity: "error",
    });
    expect(stats.alerts[1]).toMatchObject({
      id: "cont-cont-2",
      type: "container",
      severity: "warning",
      title: "Container Restart Loop",
    });
    expect(stats.containers).toHaveLength(3);
  });

  it("handles empty inputs", () => {
    const stats = buildDashboardStats([], undefined);

    expect(stats).toMatchObject({
      hostsCount: 0,
      connectedCount: 0,
      unhealthyCount: 0,
      containersCount: 0,
      runningCount: 0,
      stoppedCount: 0,
    });
    expect(stats.alerts).toEqual([]);
    expect(stats.containers).toEqual([]);
  });
});

