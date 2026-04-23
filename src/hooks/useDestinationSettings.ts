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

// ── Helpers ─────────────────────────────────────────────────────────

interface TestResult {
  succeeded: boolean;
  http_status?: number;
  error_summary?: string;
}

/** Show a success/failure toast for a destination test attempt. */
function buildTestToast(attempt: TestResult, label: string) {
  if (attempt.succeeded) {
    return {
      title: `${label} test delivered`,
      description: attempt.http_status
        ? `${label} responded with ${attempt.http_status}.`
        : `${label} accepted the test message.`,
    } as const;
  }
  return {
    title: `${label} test failed`,
    description: attempt.error_summary ?? `${label} did not accept the test message.`,
    variant: "destructive",
  } as const;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useDestinationSettings(orgId: string | undefined, canSlack: boolean, canWebhook: boolean) {
  const { toast } = useToast();
  const [latestSecret, setLatestSecret] = useState<{ destinationName: string; value: string } | null>(null);

  /** Run a mutation and show a toast, catching errors uniformly. */
  async function run<T>(fn: () => Promise<T>, successTitle: string, errorTitle: string): Promise<T | undefined> {
    try {
      const result = await fn();
      toast({ title: successTitle });
      return result;
    } catch (error) {
      toast({
        title: errorTitle,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      return undefined;
    }
  }

  // ── Slack queries & mutations ─────────────────────────────────────
  const slackQuery = useSlackDestinations(orgId, canSlack);
  const createSlackMut = useCreateSlackDestination();
  const updateSlackMut = useUpdateSlackDestination();
  const testSlackMut = useTestSlackDestination();

  const handleCreateSlack = (values: SlackDestinationFormValues) =>
    run(() => createSlackMut.mutateAsync(values), "Slack destination created", "Failed to create Slack destination");

  const handleUpdateSlack = (id: string, values: Partial<SlackDestinationFormValues>) =>
    run(() => updateSlackMut.mutateAsync({ id, values }), "Slack destination updated", "Failed to update Slack destination");

  const handleTestSlack = async (id: string) => {
    try {
      const attempt = await testSlackMut.mutateAsync(id);
      toast(buildTestToast(attempt, "Slack"));
    } catch (error) {
      toast({ title: "Failed to send Slack test", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  // ── Webhook queries & mutations ───────────────────────────────────
  const webhookQuery = useWebhookDestinations(orgId, canWebhook);
  const createWebhookMut = useCreateWebhookDestination();
  const updateWebhookMut = useUpdateWebhookDestination();
  const testWebhookMut = useTestWebhookDestination();

  const handleCreateWebhook = async (values: WebhookDestinationFormValues) => {
    const result = await run(
      () => createWebhookMut.mutateAsync(values),
      "Webhook destination created",
      "Failed to create webhook destination",
    );
    if (result?.signing_secret) {
      setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
    }
  };

  const handleUpdateWebhook = async (id: string, values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean }) => {
    const result = await run(
      () => updateWebhookMut.mutateAsync({ id, values }),
      "Webhook destination updated",
      "Failed to update webhook destination",
    );
    if (result?.signing_secret) {
      setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
      toast({ title: "Signing secret regenerated" });
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const attempt = await testWebhookMut.mutateAsync(id);
      toast(buildTestToast(attempt, "Endpoint"));
    } catch (error) {
      toast({ title: "Failed to send webhook test", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  // ── Return ────────────────────────────────────────────────────────
  return {
    slack: {
      destinations: slackQuery.data?.destinations ?? [],
      canManage: slackQuery.data?.can_manage ?? false,
      saving: createSlackMut.isPending || updateSlackMut.isPending,
      testingId: testSlackMut.isPending ? testSlackMut.variables : null,
      onCreate: handleCreateSlack,
      onUpdate: handleUpdateSlack,
      onTest: handleTestSlack,
    },
    webhook: {
      destinations: webhookQuery.data?.destinations ?? [],
      canManage: webhookQuery.data?.can_manage ?? false,
      saving: createWebhookMut.isPending || updateWebhookMut.isPending,
      testingId: testWebhookMut.isPending ? testWebhookMut.variables : null,
      latestSecret,
      onCreate: handleCreateWebhook,
      onUpdate: handleUpdateWebhook,
      onTest: handleTestWebhook,
      onDismissSecret: () => setLatestSecret(null),
    },
  };
}
