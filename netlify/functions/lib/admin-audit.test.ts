import { describe, expect, it } from "vitest";

import { assertAdminReason, normalizeAdminReason } from "./admin-audit.mjs";

describe("admin audit helpers", () => {
  it("normalizes reason strings", () => {
    expect(normalizeAdminReason("  support action  ")).toBe("support action");
    expect(normalizeAdminReason(null)).toBe("");
  });

  it("rejects empty reasons", () => {
    expect(() => assertAdminReason("")).toThrow(/reason is required/i);
    expect(() => assertAdminReason("ok")).not.toThrow();
  });
});
