import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSlackDestination,
  useSlackDestinations,
  useTestSlackDestination,
  useUpdateSlackDestination,
} from "@/hooks/useSlackDestinations";
import {
  useCreateWebhookDestination,
  useTestWebhookDestination,
  useUpdateWebhookDestination,
  useWebhookDestinations,
} from "@/hooks/useWebhookDestinations";
import type { SlackDestinationFormValues, WebhookDestinationFormValues } from "@/types/alerts";

export function useDestinationSettings(orgId: string | undefined, canSlack: boolean, canWebhook: boolean) {
  const { toast } = useToast();
  const [latestSecret, setLatestSecret] = useState<{ destinationName: string; value: string } | null>(null);

  // ── Slack ──────────────────────────────────────────────────────────
  const slackQuery = useSlackDestinations(orgId, canSlack);
  const createSlackMut = useCreateSlackDestination();
  const updateSlackMut = useUpdateSlackDestination();
  const testSlackMut = useTestSlackDestination();

  const slackDestinations = slackQuery.data?.destinations ?? [];
  const slackCanManage = slackQuery.data?.can_manage ?? false;
  const slackSaving = createSlackMut.isPending || updateSlackMut.isPending;

  // ── Webhooks ──────────────────────────────────────────────────────
  const webhookQuery = useWebhookDestinations(orgId, canWebhook);
  const createWebhookMut = useCreateWebhookDestination();
  const updateWebhookMut = useUpdateWebhookDestination();
  const testWebhookMut = useTestWebhookDestination();

  const webhookDestinations = webhookQuery.data?.destinations ?? [];
  const webhookCanManage = webhookQuery.data?.can_manage ?? false;
  const webhookSaving = createWebhookMut.isPending || updateWebhookMut.isPending;

  // ── Shared error handler ──────────────────────────────────────────
  const toastError = (title: string, error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
  };

  // ── Slack handlers ────────────────────────────────────────────────
  const handleCreateSlack = async (values: SlackDestinationFormValues) => {
    try {
      await createSlackMut.mutateAsync(values);
      toast({ title: "Slack destination created" });
    } catch (error) {
      toastError("Failed to create Slack destination", error);
    }
  };

  const handleUpdateSlack = async (id: string, values: Partial<SlackDestinationFormValues>) => {
    try {
      await updateSlackMut.mutateAsync({ id, values });
      toast({ title: "Slack destination updated" });
    } catch (error) {
      toastError("Failed to update Slack destination", error);
    }
  };

  const handleTestSlack = async (id: string) => {
    try {
      const attempt = await testSlackMut.mutateAsync(id);
      toast({
        title: attempt.succeeded ? "Slack test delivered" : "Slack test failed",
        description: attempt.succeeded
          ? attempt.http_status ? `Slack responded with ${attempt.http_status}.` : "Slack accepted the test message."
          : attempt.error_summary ?? "Slack did not accept the test message.",
        variant: attempt.succeeded ? "default" : "destructive",
      });
    } catch (error) {
      toastError("Failed to send Slack test", error);
    }
  };

  // ── Webhook handlers ──────────────────────────────────────────────
  const handleCreateWebhook = async (values: WebhookDestinationFormValues) => {
    try {
      const result = await createWebhookMut.mutateAsync(values);
      if (result.signing_secret) {
        setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
      }
      toast({ title: "Webhook destination created" });
    } catch (error) {
      toastError("Failed to create webhook destination", error);
    }
  };

  const handleUpdateWebhook = async (id: string, values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean }) => {
    try {
      const result = await updateWebhookMut.mutateAsync({ id, values });
      if (result.signing_secret) {
        setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
        toast({ title: "Signing secret regenerated" });
        return;
      }
      toast({ title: "Webhook destination updated" });
    } catch (error) {
      toastError("Failed to update webhook destination", error);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const attempt = await testWebhookMut.mutateAsync(id);
      toast({
        title: attempt.succeeded ? "Webhook test delivered" : "Webhook test failed",
        description: attempt.succeeded
          ? attempt.http_status ? `Endpoint responded with ${attempt.http_status}.` : "The endpoint accepted the test request."
          : attempt.error_summary ?? "The endpoint did not accept the signed test request.",
        variant: attempt.succeeded ? "default" : "destructive",
      });
    } catch (error) {
      toastError("Failed to send webhook test", error);
    }
  };

  return {
    slack: {
      destinations: slackDestinations,
      canManage: slackCanManage,
      saving: slackSaving,
      testingId: testSlackMut.isPending ? testSlackMut.variables : null,
      onCreate: handleCreateSlack,
      onUpdate: handleUpdateSlack,
      onTest: handleTestSlack,
    },
    webhook: {
      destinations: webhookDestinations,
      canManage: webhookCanManage,
      saving: webhookSaving,
      testingId: testWebhookMut.isPending ? testWebhookMut.variables : null,
      latestSecret,
      onCreate: handleCreateWebhook,
      onUpdate: handleUpdateWebhook,
      onTest: handleTestWebhook,
      onDismissSecret: () => setLatestSecret(null),
    },
  };
}
