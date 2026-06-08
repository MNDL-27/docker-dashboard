import { describe, expect, it } from "vitest";

function normalizeAdminReason(reason: unknown): string {
  return typeof reason === "string" ? reason.trim() : "";
}

function assertAdminReason(reason: string) {
  if (!reason.trim()) {
    throw new Error("Reason is required for admin actions.");
  }
}

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
