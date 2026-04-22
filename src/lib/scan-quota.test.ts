import { describe, expect, it } from "vitest";

import {
  formatScanQuotaResetDate,
  formatScanQuotaSummary,
  formatScanRefreshCost,
  isScanQuotaExhausted,
} from "@/lib/scan-quota";

describe("scan quota helpers", () => {
  it("formats capped quota usage with remaining scans and reset date", () => {
    expect(
      formatScanQuotaSummary({
        plan: "free",
        limit: 100,
        used: 42,
        remaining: 58,
        resetAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe("42 / 100 used · 58 left · resets May 1");
  });

  it("formats exhausted capped quota state", () => {
    expect(
      formatScanQuotaSummary({
        plan: "free",
        limit: 100,
        used: 100,
        remaining: 0,
        resetAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe("100 / 100 used · 0 left · resets May 1");
    expect(isScanQuotaExhausted(100, 0)).toBe(true);
  });

  it("returns no capped summary for unlimited plans", () => {
    expect(
      formatScanQuotaSummary({
        plan: "pro",
        limit: null,
        used: 12,
        remaining: null,
        resetAt: "2026-05-01T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("formats refresh cost copy with singular and plural scan counts", () => {
    expect(formatScanRefreshCost(1)).toBe("This refresh uses 1 scan.");
    expect(formatScanRefreshCost(3)).toBe("This refresh uses 3 scans.");
  });

  it("formats reset dates in UTC month/day form", () => {
    expect(formatScanQuotaResetDate("2026-05-01T00:00:00.000Z")).toBe("May 1");
  });
});
