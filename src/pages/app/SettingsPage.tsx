import { PageHeader } from "@/components/shared/PageHeader";
import { useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { Construction } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { WebhookDestinationsPanel } from "@/components/settings/WebhookDestinationsPanel";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@clerk/clerk-react";
import { useCreateWebhookDestination, useTestWebhookDestination, useUpdateWebhookDestination, useWebhookDestinations } from "@/hooks/useWebhookDestinations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WebhookDestinationFormValues } from "@/types/alerts";

const tabs = ["Profile", "General", "API Keys", "Webhooks", "Notifications", "Audit Logs", "Danger Zone"];

export default function SettingsPage() {
  const { organization: currentOrg } = useOrganization();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(requestedTab && tabs.includes(requestedTab) ? requestedTab : "Profile");
  const [latestSecret, setLatestSecret] = useState<{ destinationName: string; value: string } | null>(null);

  const webhookDestinationsQuery = useWebhookDestinations(currentOrg?.id);
  const createWebhookMutation = useCreateWebhookDestination();
  const updateWebhookMutation = useUpdateWebhookDestination();
  const testWebhookMutation = useTestWebhookDestination();

  const webhookDestinations = webhookDestinationsQuery.data?.destinations ?? [];
  const canManage = webhookDestinationsQuery.data?.can_manage ?? false;
  const webhookSaving = createWebhookMutation.isPending || updateWebhookMutation.isPending;

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "Profile") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleWebhookError = (title: string, error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
  };

  const handleCreateWebhook = async (values: WebhookDestinationFormValues) => {
    try {
      const result = await createWebhookMutation.mutateAsync(values);
      if (result.signing_secret) {
        setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
      }
      toast({ title: "Webhook destination created" });
    } catch (error) {
      handleWebhookError("Failed to create webhook destination", error);
    }
  };

  const handleUpdateWebhook = async (id: string, values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean }) => {
    try {
      const result = await updateWebhookMutation.mutateAsync({ id, values });
      if (result.signing_secret) {
        setLatestSecret({ destinationName: result.destination.name, value: result.signing_secret });
        toast({ title: "Signing secret regenerated" });
        return;
      }
      toast({ title: "Webhook destination updated" });
    } catch (error) {
      handleWebhookError("Failed to update webhook destination", error);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const attempt = await testWebhookMutation.mutateAsync(id);
      toast({
        title: attempt.succeeded ? "Webhook test delivered" : "Webhook test failed",
        description: attempt.succeeded
          ? attempt.http_status ? `Endpoint responded with ${attempt.http_status}.` : "The endpoint accepted the test request."
          : attempt.error_summary ?? "The endpoint did not accept the signed test request.",
        variant: attempt.succeeded ? "default" : "destructive",
      });
    } catch (error) {
      handleWebhookError("Failed to send webhook test", error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage organization and project settings"
        breadcrumbs={[{ label: "Management" }, { label: "Settings" }]}
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-secondary p-1">
          {tabs.map((currentTab) => (
            <TabsTrigger key={currentTab} value={currentTab} className="text-xs">
              {currentTab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="Webhooks">
          <WebhookDestinationsPanel
            destinations={webhookDestinations}
            canManage={canManage}
            saving={webhookSaving}
            testingId={testWebhookMutation.isPending ? testWebhookMutation.variables : null}
            latestSecret={latestSecret}
            onCreate={handleCreateWebhook}
            onUpdate={handleUpdateWebhook}
            onTest={handleTestWebhook}
            onDismissSecret={() => setLatestSecret(null)}
          />
        </TabsContent>

        {tabs.filter((currentTab) => !["Profile", "Webhooks"].includes(currentTab)).map((currentTab) => (
          <TabsContent key={currentTab} value={currentTab}>
            <div className="glass-card p-12 text-center">
              <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">Coming Soon</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {currentTab} settings are under development.
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
