import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { HostWorkspace } from "@/components/hosts/HostWorkspace";

const hosts = [
  {
    id: "host-1",
    organization_id: "org-1",
    name: "alpha-host",
    host_url: "https://alpha.example.com",
    connection_mode: "agent",
    docker_socket_path: "/var/run/docker.sock",
    status: "connected",
    docker_version: "26.1",
    agent_version: "1.0.0",
    os_info: "linux/amd64",
    last_seen_at: "2026-04-13T10:00:00.000Z",
    consecutive_failures: 0,
    last_error: null,
    created_by: "user-1",
    created_at: "2026-04-13T10:00:00.000Z",
    updated_at: "2026-04-13T10:00:00.000Z",
  },
  {
    id: "host-2",
    organization_id: "org-1",
    name: "beta-host",
    host_url: "https://beta.example.com",
    connection_mode: "cloudflare_tunnel",
    docker_socket_path: "/var/run/docker.sock",
    status: "connected",
    docker_version: "26.1",
    agent_version: "1.0.0",
    os_info: "linux/arm64",
    last_seen_at: "2026-04-13T10:00:00.000Z",
    consecutive_failures: 0,
    last_error: null,
    created_by: "user-1",
    created_at: "2026-04-13T10:00:00.000Z",
    updated_at: "2026-04-13T10:00:00.000Z",
  },
];

const metricsPoint = {
  timestamp: 1710000000000,
  time: "10:00",
  cpu: 42,
  memory: 38,
  usedCores: 3.36,
  totalCores: 8,
  memoryUsed: 12_000_000_000,
  memoryLimit: 32_000_000_000,
  networkInBytesPerSec: 1024,
  networkOutBytesPerSec: 2048,
  diskReadBytesPerSec: 4096,
  diskWriteBytesPerSec: 8192,
};

const mockUseOrganization = vi.fn();
const mockUseDockerHosts = vi.fn();
const mockUseDeleteDockerHost = vi.fn();
const mockUseHostContainers = vi.fn();
const mockUseHostMetrics = vi.fn();
const mockUseHostMetricsHistory = vi.fn();
const mockUseToast = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useOrganization: () => mockUseOrganization(),
}));

vi.mock("@/hooks/useDocker", () => ({
  useDockerHosts: (...args: unknown[]) => mockUseDockerHosts(...args),
  useDeleteDockerHost: () => mockUseDeleteDockerHost(),
  useHostContainers: (...args: unknown[]) => mockUseHostContainers(...args),
}));

vi.mock("@/hooks/useHostMetrics", () => ({
  useHostMetrics: (...args: unknown[]) => mockUseHostMetrics(...args),
  useHostMetricsHistory: (...args: unknown[]) => mockUseHostMetricsHistory(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/components/docker/AddHostDialog", () => ({
  AddHostDialog: ({ trigger }: { trigger?: ReactNode }) => trigger ?? <button type="button">Add Host Dialog</button>,
}));

describe("HostWorkspace", () => {
  beforeEach(() => {
    mockUseOrganization.mockReturnValue({ organization: { id: "org-1" } });
    mockUseDockerHosts.mockReturnValue({ data: hosts, isLoading: false, refetch: vi.fn() });
    mockUseDeleteDockerHost.mockReturnValue({ mutateAsync: vi.fn() });
    mockUseHostContainers.mockReturnValue({
      data: [
        { Id: "abc123456789", Names: ["/web"], Image: "nginx:latest", State: "running" },
      ],
      isLoading: false,
    });
    mockUseHostMetrics.mockReturnValue({ data: metricsPoint });
    mockUseHostMetricsHistory.mockReturnValue({
      history: [metricsPoint],
      latestPoint: metricsPoint,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseToast.mockReturnValue({ toast: vi.fn() });
  });

  function renderWorkspace(entry: string) {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/hosts" element={<HostWorkspace />} />
          <Route path="/app/hosts/:id" element={<HostWorkspace />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("selects the first host on /app/hosts", () => {
    renderWorkspace("/app/hosts");

    expect(screen.getByRole("heading", { name: "alpha-host" })).toBeInTheDocument();
    expect(screen.getByText("Endpoint: https://alpha.example.com")).toBeInTheDocument();
  });

  it("preselects the route host on /app/hosts/:id", () => {
    renderWorkspace("/app/hosts/host-2");

    expect(screen.getByRole("heading", { name: "beta-host" })).toBeInTheDocument();
    expect(screen.getByText("Endpoint: https://beta.example.com")).toBeInTheDocument();
  });

  it("updates the detail pane when a host is selected from the list", () => {
    renderWorkspace("/app/hosts");

    fireEvent.click(screen.getByRole("button", { name: /beta-host/i }));

    expect(screen.getByRole("heading", { name: "beta-host" })).toBeInTheDocument();
    expect(screen.getByText("Endpoint: https://beta.example.com")).toBeInTheDocument();
  });

  it("treats stale hosts as readable instead of disconnected", () => {
    mockUseDockerHosts.mockReturnValue({
      data: [{ ...hosts[0], status: "stale" }],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWorkspace("/app/hosts");

    expect(screen.getByText(/heartbeat is stale/i)).toBeInTheDocument();
    expect(screen.queryByText(/host is disconnected/i)).not.toBeInTheDocument();
    expect(mockUseHostContainers).toHaveBeenCalledWith("host-1");
    expect(mockUseHostMetricsHistory).toHaveBeenCalledWith("host-1", expect.objectContaining({ enabled: true }));
  });
});
