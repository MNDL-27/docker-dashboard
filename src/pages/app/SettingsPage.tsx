import { PageHeader } from "@/components/shared/PageHeader";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { OrganizationMembersWorkspaceContainer } from "@/components/settings/OrganizationMembersWorkspace";
import { useEffect, useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { useSearchParams } from "react-router-dom";
import { SlackDestinationsPanel } from "@/components/settings/SlackDestinationsPanel";
import { WebhookDestinationsPanel } from "@/components/settings/WebhookDestinationsPanel";
import { useOrganization } from "@clerk/clerk-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewerState } from "@/hooks/useViewerState";
import { useDestinationSettings } from "@/hooks/useDestinationSettings";

const allTabs = ["Members", "Profile", "Webhooks", "Notifications"];

export default function SettingsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const entitlements = viewer?.entitlements;
  const canUseTeamCollaboration = entitlements?.canUseTeamCollaboration ?? false;
  const canUseWebhookDestinations = entitlements?.canUseWebhookDestinations ?? false;
  const canUseSlackDestinations = entitlements?.canUseSlackDestinations ?? false;

  const tabs = allTabs;

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(requestedTab && tabs.includes(requestedTab) ? requestedTab : "Profile");

  const { slack, webhook } = useDestinationSettings(currentOrg?.id, canUseSlackDestinations, canUseWebhookDestinations);

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

  useEffect(() => {
    if (!tabs.includes(tab)) {
      setTab("Profile");
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("tab");
      setSearchParams(nextParams, { replace: true });
    }
  }, [tab, tabs, searchParams, setSearchParams]);

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

        <TabsContent value="Members">
          {canUseTeamCollaboration ? (
            <OrganizationMembersWorkspaceContainer />
          ) : (
            <PremiumFeatureBlock
              title="Team Collaboration"
              description="Upgrade your plan to invite team members to your organization and manage access together."
            />
          )}
        </TabsContent>

        <TabsContent value="Webhooks">
          {canUseWebhookDestinations ? (
            <WebhookDestinationsPanel
              destinations={webhook.destinations}
              canManage={webhook.canManage}
              saving={webhook.saving}
              testingId={webhook.testingId}
              latestSecret={webhook.latestSecret}
              onCreate={webhook.onCreate}
              onUpdate={webhook.onUpdate}
              onTest={webhook.onTest}
              onDismissSecret={webhook.onDismissSecret}
            />
          ) : (
            <PremiumFeatureBlock
              title="Webhook Destinations"
              description="Upgrade your plan to configure custom webhook destinations for real-time alerts."
            />
          )}
        </TabsContent>

        <TabsContent value="Notifications">
          {canUseSlackDestinations ? (
            <SlackDestinationsPanel
              destinations={slack.destinations}
              canManage={slack.canManage}
              saving={slack.saving}
              testingId={slack.testingId}
              onCreate={slack.onCreate}
              onUpdate={slack.onUpdate}
              onTest={slack.onTest}
            />
          ) : (
            <PremiumFeatureBlock
              title="Slack & Discord Notifications"
              description="Upgrade your plan to integrate with Slack and Discord and receive alerts directly in your channels."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
