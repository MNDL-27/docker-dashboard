export type OrganizationRole = "owner" | "admin" | "member";

export interface OrganizationAccessMemberRow {
  user_id: string;
  clerk_user_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

export interface OrganizationAccessInvitationItem {
  id: string;
  email: string;
  role: OrganizationRole;
  created_at: string;
  expires_at: string | null;
  status: "invited";
}

export function normalizeOrganizationRole(role: string | null | undefined): OrganizationRole {
  const normalized = (role || "member").toLowerCase().replace(/^org:/, "");
  if (normalized === "owner" || normalized === "admin") return normalized;
  return "member";
}

export function toClerkOrganizationRole(role: OrganizationRole) {
  return `org:${role}` as const;
}

export function canManageOrganizationMembers(role: string | null | undefined) {
  const normalized = normalizeOrganizationRole(role);
  return normalized === "owner" || normalized === "admin";
}

export function countPrivilegedMembers(members: Array<{ role: string }>) {
  return members.filter((member) => ["owner", "admin"].includes(normalizeOrganizationRole(member.role))).length;
}

export function countOwners(members: Array<{ role: string }>) {
  return members.filter((member) => normalizeOrganizationRole(member.role) === "owner").length;
}

export function buildOrganizationAccessSummary(
  members: Array<{ role: string }>,
  invitations: OrganizationAccessInvitationItem[],
) {
  return {
    members_count: members.length,
    pending_invites_count: invitations.length,
    admins_count: countPrivilegedMembers(members),
  };
}

export function assertOrganizationMemberMutationAllowed({
  requesterRole,
  targetRole,
  nextRole,
  ownerCount,
  isRemoval = false,
}: {
  requesterRole: string;
  targetRole: string;
  nextRole?: string;
  ownerCount: number;
  isRemoval?: boolean;
}) {
  const requester = normalizeOrganizationRole(requesterRole);
  const target = normalizeOrganizationRole(targetRole);
  const next = nextRole ? normalizeOrganizationRole(nextRole) : undefined;

  if (!canManageOrganizationMembers(requester)) {
    throw new Error("Admin access required for active organization");
  }

  if (requester === "admin") {
    if (target === "owner") {
      throw new Error("Admins cannot manage owners");
    }
    if (next === "owner") {
      throw new Error("Admins cannot promote members to owner");
    }
  }

  if (target === "owner" && (isRemoval || next === "admin" || next === "member") && ownerCount <= 1) {
    throw new Error("The last owner cannot be removed or demoted");
  }
}
