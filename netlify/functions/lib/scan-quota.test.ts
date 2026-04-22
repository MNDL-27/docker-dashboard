import { describe, expect, it, vi } from "vitest";

vi.mock("./db.mjs", () => ({
  sql: vi.fn(),
}));

vi.mock("./ensure-admin-schema.mjs", () => ({
  ensureAdminSchema: vi.fn(),
}));

vi.mock("./ensure-scan-usage-schema.mjs", () => ({
  ensureScanUsageSchema: vi.fn(),
}));

import { computeOrganizationEntitlements } from "./access-controls.mts";
import { getCurrentScanMonthBucket, getNextScanResetAt } from "./scan-usage.mts";

describe("scan quota entitlement", () => {
  it("keeps free organizations on the monthly scan cap", () => {
    expect(
      computeOrganizationEntitlements({
        plan: "free",
        subscriptionStatus: "inactive",
        isDonorPremium: false,
        isPlatformAdmin: false,
      }),
    ).toMatchObject({
      plan: "free",
      monthlyScanLimit: 100,
      canUseAdvancedAlerts: false,
    });
  });

  it("promotes donor premium organizations to unlimited scans", () => {
    expect(
      computeOrganizationEntitlements({
        plan: "free",
        subscriptionStatus: "inactive",
        isDonorPremium: true,
        isPlatformAdmin: false,
      }),
    ).toMatchObject({
      plan: "free",
      isDonorPremium: true,
      monthlyScanLimit: null,
      canUseAdvancedAlerts: true,
    });
  });

  it("keeps paid organizations unlimited while subscriptions are active", () => {
    expect(
      computeOrganizationEntitlements({
        plan: "team",
        subscriptionStatus: "active",
        isDonorPremium: false,
        isPlatformAdmin: false,
      }),
    ).toMatchObject({
      plan: "team",
      monthlyScanLimit: null,
      nodeLimit: 25,
    });
  });

  it("falls back to the free scan cap when a paid subscription is inactive", () => {
    expect(
      computeOrganizationEntitlements({
        plan: "pro",
        subscriptionStatus: "inactive",
        isDonorPremium: false,
        isPlatformAdmin: false,
      }),
    ).toMatchObject({
      plan: "pro",
      monthlyScanLimit: 100,
      nodeLimit: 1,
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
