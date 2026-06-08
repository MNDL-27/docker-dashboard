import { apiFetch } from "@/lib/api";
import type {
  OrganizationAccessInvitation,
  OrganizationAccessMember,
  OrganizationAccessResponse,
  OrganizationInvitationFormValues,
  OrganizationMemberRole,
} from "@/types/organization-access";

export const organizationAccessApi = {
  getAccess: () => apiFetch("/org-access") as Promise<OrganizationAccessResponse>,
  inviteMember: (values: OrganizationInvitationFormValues) =>
    apiFetch("/org-access/invitations", {
      method: "POST",
      body: JSON.stringify(values),
    }) as Promise<OrganizationAccessInvitation>,
  resendInvitation: (id: string) =>
    apiFetch(`/org-access/invitations/${id}/resend`, {
      method: "POST",
    }) as Promise<OrganizationAccessInvitation>,
  revokeInvitation: (id: string) =>
    apiFetch(`/org-access/invitations/${id}`, {
      method: "DELETE",
    }) as Promise<OrganizationAccessInvitation>,
  updateMemberRole: (userId: string, role: OrganizationMemberRole) =>
    apiFetch(`/org-access/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }) as Promise<OrganizationAccessMember>,
  removeMember: (userId: string) =>
    apiFetch(`/org-access/members/${userId}`, {
      method: "DELETE",
    }) as Promise<{ success: boolean; user_id: string }>,
};
