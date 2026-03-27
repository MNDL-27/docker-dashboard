import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALE_THRESHOLD_MINUTES,
  DEFAULT_UNHEALTHY_THRESHOLD,
  parseStaleThresholdMinutes,
  shouldMarkHostStale,
  failureStatusForCount,
} from "./host-health-state";

describe("host stale-state rules", () => {
  it("uses default stale threshold when env is missing or invalid", () => {
    expect(parseStaleThresholdMinutes(undefined)).toBe(DEFAULT_STALE_THRESHOLD_MINUTES);
    expect(parseStaleThresholdMinutes("bad")).toBe(DEFAULT_STALE_THRESHOLD_MINUTES);
    expect(parseStaleThresholdMinutes("0")).toBe(DEFAULT_STALE_THRESHOLD_MINUTES);
  });

  it("marks connected hosts stale when last_seen_at is older than threshold", () => {
    const now = new Date("2026-03-27T12:00:00.000Z");
    const host = {
      status: "connected",
      last_seen_at: "2026-03-27T11:54:00.000Z", // 6 min old
    };

    expect(shouldMarkHostStale(host, now, 5)).toBe(true);
  });

  it("does not mark stale when still fresh or not connected", () => {
    const now = new Date("2026-03-27T12:00:00.000Z");

    expect(
      shouldMarkHostStale({ status: "connected", last_seen_at: "2026-03-27T11:58:00.000Z" }, now, 5),
    ).toBe(false);

    expect(
      shouldMarkHostStale({ status: "error", last_seen_at: "2026-03-27T11:00:00.000Z" }, now, 5),
    ).toBe(false);

    expect(
      shouldMarkHostStale({ status: "unhealthy", last_seen_at: "2026-03-27T11:00:00.000Z" }, now, 5),
    ).toBe(false);
  });

  it("keeps existing failure escalation behavior intact", () => {
    expect(failureStatusForCount(1, DEFAULT_UNHEALTHY_THRESHOLD)).toBe("error");
    expect(failureStatusForCount(2, DEFAULT_UNHEALTHY_THRESHOLD)).toBe("error");
    expect(failureStatusForCount(3, DEFAULT_UNHEALTHY_THRESHOLD)).toBe("unhealthy");
    expect(failureStatusForCount(9, DEFAULT_UNHEALTHY_THRESHOLD)).toBe("unhealthy");
  });
});
