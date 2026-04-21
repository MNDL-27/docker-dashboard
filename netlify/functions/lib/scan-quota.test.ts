import { describe, expect, it, vi } from "vitest";

vi.mock("./db.mjs", () => ({
  sql: vi.fn(),
}));

vi.mock("./ensure-admin-schema.mjs", () => ({
  ensureAdminSchema: vi.fn(),
}));

import {
  buildScanQuotaEntitlement,
  FREE_PLAN_MONTHLY_SCAN_LIMIT,
  getCurrentScanMonthBucket,
  getNextScanResetAt,
} from "./scan-quota.mts";

describe("scan quota entitlement", () => {
  it("keeps free organizations on the monthly scan cap", () => {
    expect(buildScanQuotaEntitlement({ basePlan: "free" })).toEqual({
      basePlan: "free",
      effectivePlan: "free",
      planOverride: null,
      donorPremiumActive: false,
      isUnlimited: false,
      monthlyScanLimit: FREE_PLAN_MONTHLY_SCAN_LIMIT,
    });
  });

  it("promotes donor premium organizations to unlimited premium scans", () => {
    expect(buildScanQuotaEntitlement({ basePlan: "free", donorPremiumActive: true })).toEqual({
      basePlan: "free",
      effectivePlan: "pro",
      planOverride: null,
      donorPremiumActive: true,
      isUnlimited: true,
      monthlyScanLimit: null,
    });
  });

  it("respects plan overrides ahead of the stored base plan", () => {
    expect(buildScanQuotaEntitlement({ basePlan: "free", planOverride: "team" })).toEqual({
      basePlan: "free",
      effectivePlan: "team",
      planOverride: "team",
      donorPremiumActive: false,
      isUnlimited: true,
      monthlyScanLimit: null,
    });
  });
});

describe("scan quota window helpers", () => {
  it("uses UTC monthly windows", () => {
    const date = new Date("2026-04-22T09:15:00.000Z");

    expect(getCurrentScanMonthBucket(date)).toBe("2026-04");
    expect(getNextScanResetAt(date)).toBe("2026-05-01T00:00:00.000Z");
  });
});
