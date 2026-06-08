export type OrganizationMemberRole = "owner" | "admin" | "member";
export type OrganizationAccessStatus = "active" | "invited";

export interface OrganizationAccessSummary {
  members_count: number;
  pending_invites_count: number;
  admins_count: number;
}

export interface OrganizationAccessMember {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: OrganizationMemberRole;
  joined_at: string;
  status: "active";
}

export interface OrganizationAccessInvitation {
  id: string;
  email: string;
  role: OrganizationMemberRole;
  created_at: string;
  expires_at: string | null;
  status: "invited";
}

export interface OrganizationAccessResponse {
  role: OrganizationMemberRole;
  can_manage_members: boolean;
  summary: OrganizationAccessSummary;
  members: OrganizationAccessMember[];
  invitations: OrganizationAccessInvitation[];
}

export interface OrganizationInvitationFormValues {
  email: string;
  role: OrganizationMemberRole;
}
