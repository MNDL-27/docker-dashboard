import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { alertsApi } from "@/services/alerts-api";
import type { AlertRuleFormValues } from "@/types/alerts";

export function useAlertsWorkspace(orgId?: string | null, filters: { severity?: string; status?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ["alerts-workspace", orgId, filters],
    queryFn: () => alertsApi.getWorkspace(filters),
    enabled: !!orgId && enabled,
    refetchInterval: 30000,
  });
}

export function useAlertRules(orgId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["alert-rules", orgId],
    queryFn: () => alertsApi.listRules(),
    enabled: !!orgId && enabled,
  });
}

export function useIncidentsFeed(orgId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["incidents-feed", orgId],
    queryFn: () => alertsApi.listIncidents(),
    enabled: !!orgId && enabled,
    refetchInterval: 30000,
  });
}

function invalidateAlertsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["alerts-workspace"] });
  queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
  queryClient.invalidateQueries({ queryKey: ["incidents-feed"] });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.acknowledgeAlert(id),
    onSuccess: () => invalidateAlertsQueries(queryClient),
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.resolveAlert(id),
    onSuccess: () => invalidateAlertsQueries(queryClient),
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AlertRuleFormValues) => alertsApi.createRule(values),
    onSuccess: () => invalidateAlertsQueries(queryClient),
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<AlertRuleFormValues> }) => alertsApi.updateRule(id, values),
    onSuccess: () => invalidateAlertsQueries(queryClient),
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, title, summary, severity }: { alertId: string; title?: string; summary?: string; severity?: string }) =>
      alertsApi.createIncident(alertId, { title, summary, severity }),
    onSuccess: () => invalidateAlertsQueries(queryClient),
  });
}
