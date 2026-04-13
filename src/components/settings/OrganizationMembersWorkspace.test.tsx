import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrganizationMembersWorkspaceView } from "@/components/settings/OrganizationMembersWorkspace";
import type { OrganizationAccessResponse } from "@/types/organization-access";

const baseData: OrganizationAccessResponse = {
  role: "owner",
  can_manage_members: true,
  summary: {
    members_count: 2,
    pending_invites_count: 1,
    admins_count: 1,
  },
  members: [
    {
      user_id: "user-1",
      email: "alex@example.com",
      full_name: "Alex Rivera",
      avatar_url: null,
      role: "owner",
      joined_at: "2026-04-10T00:00:00.000Z",
      status: "active",
    },
    {
      user_id: "user-2",
      email: "jordan@example.com",
      full_name: "Jordan Smith",
      avatar_url: null,
      role: "member",
      joined_at: "2026-04-11T00:00:00.000Z",
      status: "active",
    },
  ],
  invitations: [
    {
      id: "invite-1",
      email: "pending@example.com",
      role: "member",
      created_at: "2026-04-12T00:00:00.000Z",
      expires_at: null,
      status: "invited",
    },
  ],
};

describe("OrganizationMembersWorkspaceView", () => {
  it("renders members and invitations together", () => {
    render(
      <OrganizationMembersWorkspaceView
        data={baseData}
        canManage
        onInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
        onResendInvitation={vi.fn()}
        onRevokeInvitation={vi.fn()}
      />,
    );

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
  });

  it("filters rows by search input", () => {
    render(
      <OrganizationMembersWorkspaceView
        data={baseData}
        canManage
        onInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
        onResendInvitation={vi.fn()}
        onRevokeInvitation={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search name or email/i), {
      target: { value: "jordan" },
    });

    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
    expect(screen.queryByText("pending@example.com")).not.toBeInTheDocument();
  });

  it("hides management controls for read-only viewers", () => {
    render(
      <OrganizationMembersWorkspaceView
        data={{ ...baseData, can_manage_members: false, role: "member" }}
        canManage={false}
        onInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
        onResendInvitation={vi.fn()}
        onRevokeInvitation={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/read only/i)).not.toHaveLength(0);
  });

  it("exports the filtered rows as csv", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <OrganizationMembersWorkspaceView
        data={baseData}
        canManage
        onInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
        onResendInvitation={vi.fn()}
        onRevokeInvitation={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });
});
