import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { organizationAccessApi } from "@/services/organization-access-api";
import type { OrganizationInvitationFormValues, OrganizationMemberRole } from "@/types/organization-access";

export function useOrganizationAccess(orgId?: string | null) {
  return useQuery({
    queryKey: ["organization-access", orgId],
    queryFn: () => organizationAccessApi.getAccess(),
    enabled: !!orgId,
  });
}

function invalidateOrganizationAccessQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["organization-access"] });
}

export function useInviteOrganizationMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: OrganizationInvitationFormValues) => organizationAccessApi.inviteMember(values),
    onSuccess: () => invalidateOrganizationAccessQueries(queryClient),
  });
}

export function useUpdateOrganizationMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationMemberRole }) =>
      organizationAccessApi.updateMemberRole(userId, role),
    onSuccess: () => invalidateOrganizationAccessQueries(queryClient),
  });
}

export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationAccessApi.removeMember(userId),
    onSuccess: () => invalidateOrganizationAccessQueries(queryClient),
  });
}

export function useRevokeOrganizationInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationAccessApi.revokeInvitation(id),
    onSuccess: () => invalidateOrganizationAccessQueries(queryClient),
  });
}

export function useResendOrganizationInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationAccessApi.resendInvitation(id),
    onSuccess: () => invalidateOrganizationAccessQueries(queryClient),
  });
}
