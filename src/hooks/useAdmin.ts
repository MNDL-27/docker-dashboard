import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminApi } from "@/services/admin-api";
import type { AdminBillingUpdate } from "@/types/admin";

export function useAdminOverview() {
  return useQuery({ queryKey: ["admin-overview"], queryFn: adminApi.getOverview });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin-users"], queryFn: adminApi.getUsers });
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => adminApi.getUser(userId!),
    enabled: Boolean(userId),
  });
}

export function useAdminOrganizations() {
  return useQuery({ queryKey: ["admin-organizations"], queryFn: adminApi.getOrganizations });
}

export function useAdminOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: ["admin-organization", organizationId],
    queryFn: () => adminApi.getOrganization(organizationId!),
    enabled: Boolean(organizationId),
  });
}

export function useAdminHosts() {
  return useQuery({ queryKey: ["admin-hosts"], queryFn: adminApi.getHosts });
}

export function useAdminAuditLog() {
  return useQuery({ queryKey: ["admin-audit-log"], queryFn: adminApi.getAuditLog });
}

export function useAdminOperations() {
  return useQuery({ queryKey: ["admin-operations"], queryFn: adminApi.getOperations });
}

function useAdminMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user"] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      queryClient.invalidateQueries({ queryKey: ["admin-hosts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["admin-operations"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
}

export function useApproveAdminUser() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.approveUser(userId, reason));
}

export function useRevokeAdminUserApproval() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.revokeApproval(userId, reason));
}

export function useSuspendAdminUser() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.suspendUser(userId, reason));
}

export function useUnsuspendAdminUser() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.unsuspendUser(userId, reason));
}

export function useHardDisableAdminUser() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.hardDisableUser(userId, reason));
}

export function useHardEnableAdminUser() {
  return useAdminMutation(({ userId, reason }: { userId: string; reason: string }) => adminApi.hardEnableUser(userId, reason));
}

export function useAddAdminOrgBan() {
  return useAdminMutation(({ userId, organizationId, reason }: { userId: string; organizationId: string; reason: string }) => adminApi.addOrgBan(userId, organizationId, reason));
}

export function useRemoveAdminOrgBan() {
  return useAdminMutation(({ userId, organizationId, reason }: { userId: string; organizationId: string; reason: string }) => adminApi.removeOrgBan(userId, organizationId, reason));
}

export function useLockAdminOrganization() {
  return useAdminMutation(({ organizationId, reason }: { organizationId: string; reason: string }) => adminApi.lockOrganization(organizationId, reason));
}

export function useUnlockAdminOrganization() {
  return useAdminMutation(({ organizationId, reason }: { organizationId: string; reason: string }) => adminApi.unlockOrganization(organizationId, reason));
}

export function useUpdateAdminBilling() {
  return useAdminMutation(({ organizationId, values }: { organizationId: string; values: AdminBillingUpdate }) => adminApi.updateBilling(organizationId, values));
}

export function useResetAdminOnboarding() {
  return useAdminMutation(({ organizationId, reason }: { organizationId: string; reason: string }) => adminApi.resetOnboarding(organizationId, reason));
}

export function useQuarantineAdminHost() {
  return useAdminMutation(({ hostId, reason }: { hostId: string; reason: string }) => adminApi.quarantineHost(hostId, reason));
}

export function useUnquarantineAdminHost() {
  return useAdminMutation(({ hostId, reason }: { hostId: string; reason: string }) => adminApi.unquarantineHost(hostId, reason));
}

export function useMarkAdminHostNeedsReconnect() {
  return useAdminMutation(({ hostId, reason }: { hostId: string; reason: string }) => adminApi.markNeedsReconnect(hostId, reason));
}

export function useRunAdminSecretMigration() {
  return useAdminMutation((values: { reason: string; organization_id?: string; host_id?: string; dry_run?: boolean }) => adminApi.migrateSecrets(values));
}
