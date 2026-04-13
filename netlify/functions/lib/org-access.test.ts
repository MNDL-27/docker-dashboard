import { describe, expect, it } from "vitest";

import {
  assertOrganizationMemberMutationAllowed,
  buildOrganizationAccessSummary,
  normalizeOrganizationRole,
} from "./org-access.mjs";

describe("org-access helpers", () => {
  it("normalizes Clerk and app role strings", () => {
    expect(normalizeOrganizationRole("org:admin")).toBe("admin");
    expect(normalizeOrganizationRole("OWNER")).toBe("owner");
    expect(normalizeOrganizationRole("unknown")).toBe("member");
  });

  it("builds summary counts from real members and invites", () => {
    expect(
      buildOrganizationAccessSummary(
        [
          { role: "owner" },
          { role: "admin" },
          { role: "member" },
        ],
        [
          {
            id: "invite-1",
            email: "pending@example.com",
            role: "member",
            created_at: "2026-04-12T00:00:00.000Z",
            expires_at: null,
            status: "invited",
          },
        ],
      ),
    ).toEqual({
      members_count: 3,
      pending_invites_count: 1,
      admins_count: 2,
    });
  });

  it("blocks admins from managing owners", () => {
    expect(() =>
      assertOrganizationMemberMutationAllowed({
        requesterRole: "admin",
        targetRole: "owner",
        ownerCount: 1,
      }),
    ).toThrow(/admins cannot manage owners/i);
  });

  it("blocks removing or demoting the last owner", () => {
    expect(() =>
      assertOrganizationMemberMutationAllowed({
        requesterRole: "owner",
        targetRole: "owner",
        ownerCount: 1,
        isRemoval: true,
      }),
    ).toThrow(/last owner/i);

    expect(() =>
      assertOrganizationMemberMutationAllowed({
        requesterRole: "owner",
        targetRole: "owner",
        nextRole: "member",
        ownerCount: 1,
      }),
    ).toThrow(/last owner/i);
  });
});
