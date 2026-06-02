import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { webhookDestinationsApi } from "@/services/webhook-destinations-api";
import type { WebhookDestinationFormValues } from "@/types/alerts";

import { useViewerState } from "@/hooks/useViewerState";

export function useWebhookDestinations(orgId?: string | null, enabled = true) {
  const { data: viewer } = useViewerState();
  const hasEntitlement = viewer?.entitlements?.canUseWebhookDestinations ?? false;

  return useQuery({
    queryKey: ["webhook-destinations", orgId],
    queryFn: () => webhookDestinationsApi.listDestinations(),
    enabled: !!orgId && enabled && hasEntitlement,
  });
}

function invalidateWebhookQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["webhook-destinations"] });
}

export function useCreateWebhookDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: WebhookDestinationFormValues) => webhookDestinationsApi.createDestination(values),
    onSuccess: () => invalidateWebhookQueries(queryClient),
  });
}

export function useUpdateWebhookDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean } }) =>
      webhookDestinationsApi.updateDestination(id, values),
    onSuccess: () => invalidateWebhookQueries(queryClient),
  });
}

export function useTestWebhookDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhookDestinationsApi.testDestination(id),
    onSuccess: () => invalidateWebhookQueries(queryClient),
  });
}
