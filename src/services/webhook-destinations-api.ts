import { apiFetch } from "@/lib/api";
import type { AlertDeliveryAttempt, WebhookDestination } from "@/types/database";
import type { WebhookDestinationFormValues } from "@/types/alerts";

export interface WebhookDestinationsResponse {
  destinations: WebhookDestination[];
  role: string;
  can_manage: boolean;
}

export interface WebhookDestinationMutationResponse {
  destination: WebhookDestination;
  signing_secret?: string;
}

export const webhookDestinationsApi = {
  listDestinations: () => apiFetch("/webhook-destinations") as Promise<WebhookDestinationsResponse>,
  createDestination: (values: WebhookDestinationFormValues) =>
    apiFetch("/webhook-destinations", {
      method: "POST",
      body: JSON.stringify(values),
    }) as Promise<WebhookDestinationMutationResponse>,
  updateDestination: (id: string, values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean }) =>
    apiFetch("/webhook-destinations", {
      method: "PATCH",
      body: JSON.stringify({ id, ...values }),
    }) as Promise<WebhookDestinationMutationResponse>,
  testDestination: (id: string) =>
    apiFetch("/webhook-destinations", {
      method: "POST",
      body: JSON.stringify({ action: "test", id }),
    }) as Promise<AlertDeliveryAttempt>,
};
