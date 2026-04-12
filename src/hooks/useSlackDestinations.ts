import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { slackDestinationsApi } from "@/services/slack-destinations-api";
import type { SlackDestinationFormValues } from "@/types/alerts";

export function useSlackDestinations(orgId?: string | null) {
  return useQuery({
    queryKey: ["slack-destinations", orgId],
    queryFn: () => slackDestinationsApi.listDestinations(),
    enabled: !!orgId,
  });
}

function invalidateSlackQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["slack-destinations"] });
}

export function useCreateSlackDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SlackDestinationFormValues) => slackDestinationsApi.createDestination(values),
    onSuccess: () => invalidateSlackQueries(queryClient),
  });
}

export function useUpdateSlackDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<SlackDestinationFormValues> }) =>
      slackDestinationsApi.updateDestination(id, values),
    onSuccess: () => invalidateSlackQueries(queryClient),
  });
}

export function useTestSlackDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => slackDestinationsApi.testDestination(id),
    onSuccess: () => invalidateSlackQueries(queryClient),
  });
}
