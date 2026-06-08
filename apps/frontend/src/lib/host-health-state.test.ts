import { describe, expect, it } from "vitest";

import {
  getHostAlertCopy,
  getHostStatusAppearance,
  isReadableHostStatus,
  isUnhealthyHostStatus,
  normalizeHostStatus,
} from "@/lib/host-health-state";

describe("host-health-state", () => {
  it("normalizes supported statuses and falls back to unknown", () => {
    expect(normalizeHostStatus("CONNECTED")).toBe("connected");
    expect(normalizeHostStatus("stale")).toBe("stale");
    expect(normalizeHostStatus("Down")).toBe("down");
    expect(normalizeHostStatus("weird-status")).toBe("unknown");
    expect(normalizeHostStatus(null)).toBe("unknown");
  });

  it("classifies readable host statuses", () => {
    expect(isReadableHostStatus("connected")).toBe(true);
    expect(isReadableHostStatus("stale")).toBe(true);
    expect(isReadableHostStatus("down")).toBe(false);
    expect(isReadableHostStatus("disconnected")).toBe(false);
    expect(isReadableHostStatus("error")).toBe(false);
  });

  it("classifies unhealthy host statuses", () => {
    expect(isUnhealthyHostStatus("stale")).toBe(true);
    expect(isUnhealthyHostStatus("error")).toBe(true);
    expect(isUnhealthyHostStatus("unhealthy")).toBe(true);
    expect(isUnhealthyHostStatus("down")).toBe(true);
    expect(isUnhealthyHostStatus("disconnected")).toBe(true);
    expect(isUnhealthyHostStatus("connected")).toBe(false);
    expect(isUnhealthyHostStatus("unknown-value")).toBe(false);
  });

  it("returns consistent appearance metadata for connected and offline states", () => {
    expect(getHostStatusAppearance("connected")).toMatchObject({
      isOnlineIcon: true,
      pillClassName: expect.stringContaining("bg-success"),
      dotClassName: expect.stringContaining("bg-success"),
    });

    expect(getHostStatusAppearance("down")).toMatchObject({
      isOnlineIcon: false,
      pillClassName: expect.stringContaining("bg-destructive"),
      dotClassName: expect.stringContaining("bg-destructive"),
    });

    expect(getHostStatusAppearance("stale")).toMatchObject({
      isOnlineIcon: false,
      pillClassName: expect.stringContaining("bg-warning"),
      dotClassName: expect.stringContaining("bg-warning"),
    });
  });

  it("returns status-aware alert copy", () => {
    expect(getHostAlertCopy("stale", "Prowlarr")).toEqual({
      title: "Host Heartbeat Stale",
      description: 'Host "Prowlarr" has not checked in recently. Metrics may be delayed until the next successful heartbeat.',
    });

    expect(getHostAlertCopy("down", "docker host")).toEqual({
      title: "Host Down",
      description: 'Host "docker host" appears offline. Check power, network reachability, and the local agent service.',
    });

    expect(getHostAlertCopy("unknown", "node-1")).toEqual({
      title: "Host Alert",
      description: 'Host "node-1" needs attention. Review connectivity and agent health.',
    });
  });
});
