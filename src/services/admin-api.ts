import { apiFetch } from "@/lib/api";
import type {
  AdminAuditEntry,
  AdminBillingEvent,
  AdminBillingUpdate,
  AdminDonorEmailDelivery,
  AdminHostRow,
  AdminOperationRun,
  AdminOrganizationDetail,
  AdminOrganizationRow,
  AdminOverview,
  AdminUserDetail,
  AdminUserRow,
} from "@/types/admin";

export const adminApi = {
  getOverview: async () => apiFetch("/admin/overview") as Promise<AdminOverview>,
  getUsers: async () => {
    const response = await apiFetch("/admin/users") as { users: AdminUserRow[] };
    return response.users;
  },
  getUser: async (userId: string) => {
    const response = await apiFetch(`/admin/users/${userId}`) as { user: AdminUserDetail };
    return response.user;
  },
  approveUser: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/approve`, { method: "POST", body: { reason } }),
  revokeApproval: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/revoke-approval`, { method: "POST", body: { reason } }),
  suspendUser: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/suspend`, { method: "POST", body: { reason } }),
  unsuspendUser: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/unsuspend`, { method: "POST", body: { reason } }),
  hardDisableUser: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/hard-disable`, { method: "POST", body: { reason } }),
  hardEnableUser: async (userId: string, reason: string) => apiFetch(`/admin/users/${userId}/hard-enable`, { method: "POST", body: { reason } }),
  addOrgBan: async (userId: string, organizationId: string, reason: string) => apiFetch(`/admin/users/${userId}/org-bans`, { method: "POST", body: { organization_id: organizationId, reason } }),
  removeOrgBan: async (userId: string, organizationId: string, reason: string) => apiFetch(`/admin/users/${userId}/org-bans/${organizationId}`, { method: "DELETE", body: { reason } }),
  getOrganizations: async () => {
    const response = await apiFetch("/admin/organizations") as { organizations: AdminOrganizationRow[] };
    return response.organizations;
  },
  getOrganization: async (organizationId: string) => {
    const response = await apiFetch(`/admin/organizations/${organizationId}`) as { organization: AdminOrganizationDetail };
    return response.organization;
  },
  lockOrganization: async (organizationId: string, reason: string) => apiFetch(`/admin/organizations/${organizationId}/lock`, { method: "POST", body: { reason } }),
  unlockOrganization: async (organizationId: string, reason: string) => apiFetch(`/admin/organizations/${organizationId}/unlock`, { method: "POST", body: { reason } }),
  updateBilling: async (organizationId: string, values: AdminBillingUpdate) => apiFetch(`/admin/organizations/${organizationId}/billing`, { method: "POST", body: values }),
  resetOnboarding: async (organizationId: string, reason: string) => apiFetch(`/admin/organizations/${organizationId}/reset-onboarding`, { method: "POST", body: { reason } }),
  getHosts: async () => {
    const response = await apiFetch("/admin/hosts") as { hosts: AdminHostRow[] };
    return response.hosts;
  },
  quarantineHost: async (hostId: string, reason: string) => apiFetch(`/admin/hosts/${hostId}/quarantine`, { method: "POST", body: { reason } }),
  unquarantineHost: async (hostId: string, reason: string) => apiFetch(`/admin/hosts/${hostId}/unquarantine`, { method: "POST", body: { reason } }),
  markNeedsReconnect: async (hostId: string, reason: string) => apiFetch(`/admin/hosts/${hostId}/mark-needs-reconnect`, { method: "POST", body: { reason } }),
  getAuditLog: async () => {
    const response = await apiFetch("/admin/audit-log") as { audit_log: AdminAuditEntry[] };
    return response.audit_log;
  },
  getOperations: async () => {
    const response = await apiFetch("/admin/operations") as { operations: AdminOperationRun[] };
    return response.operations;
  },
  migrateSecrets: async (values: { reason: string; organization_id?: string; host_id?: string; dry_run?: boolean }) => apiFetch("/admin/migrate-secrets", { method: "POST", body: values }),
  getUnmatchedBillingEvents: async (limit = 50) => {
    const response = await apiFetch(`/admin/billing/unmatched?limit=${limit}`) as { events: AdminBillingEvent[] };
    return response.events;
  },
  matchBillingEvent: async (values: { billing_event_id: string; organization_id: string; reason: string; grant_days?: number }) =>
    apiFetch("/admin/billing/match", { method: "POST", body: values }),
  getDonorEmailDeliveries: async (limit = 100) => {
    const response = await apiFetch(`/admin/billing/email-deliveries?limit=${limit}`) as { deliveries: AdminDonorEmailDelivery[] };
    return response.deliveries;
  },
  getDonorEmailDelivery: async (deliveryId: string) => {
    const response = await apiFetch(`/admin/billing/email-deliveries/${deliveryId}`) as { delivery: AdminDonorEmailDelivery };
    return response.delivery;
  },
  resendDonorEmailDelivery: async (deliveryId: string, reason: string) =>
    apiFetch(`/admin/billing/email-deliveries/${deliveryId}/resend`, { method: "POST", body: { reason } }),
  getNotifications: async () => {
    const response = await apiFetch("/admin/notifications") as { notifications: any[] };
    return response.notifications;
  },
  createNotification: async (values: { title: string; message: string; type?: string; organizationId?: string | null; link?: string | null; expiresAt?: string | null; reason: string }) =>
    apiFetch("/admin/notifications", { method: "POST", body: values }),
  deleteNotification: async (id: string, reason: string) =>
    apiFetch(`/admin/notifications/${id}`, { method: "DELETE", body: { reason } }),
};
