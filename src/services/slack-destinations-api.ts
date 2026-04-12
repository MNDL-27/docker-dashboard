import { apiFetch } from "@/lib/api";
import type { AlertDeliveryAttempt, SlackDestination } from "@/types/database";
import type { SlackDestinationFormValues } from "@/types/alerts";

export interface SlackDestinationsResponse {
  destinations: SlackDestination[];
  role: string;
  can_manage: boolean;
}

export const slackDestinationsApi = {
  listDestinations: () => apiFetch("/slack-destinations") as Promise<SlackDestinationsResponse>,
  createDestination: (values: SlackDestinationFormValues) =>
    apiFetch("/slack-destinations", {
      method: "POST",
      body: JSON.stringify(values),
    }) as Promise<SlackDestination>,
  updateDestination: (id: string, values: Partial<SlackDestinationFormValues>) =>
    apiFetch("/slack-destinations", {
      method: "PATCH",
      body: JSON.stringify({ id, ...values }),
    }) as Promise<SlackDestination>,
  testDestination: (id: string) =>
    apiFetch("/slack-destinations", {
      method: "POST",
      body: JSON.stringify({ action: "test", id }),
    }) as Promise<AlertDeliveryAttempt>,
};
