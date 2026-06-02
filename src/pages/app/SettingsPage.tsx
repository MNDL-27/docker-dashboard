import { PageHeader } from "@/components/shared/PageHeader";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { OrganizationMembersWorkspaceContainer } from "@/components/settings/OrganizationMembersWorkspace";
import { useCallback, useEffect, useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { useSearchParams } from "react-router-dom";
import { SlackDestinationsPanel } from "@/components/settings/SlackDestinationsPanel";
import { WebhookDestinationsPanel } from "@/components/settings/WebhookDestinationsPanel";
import { useOrganization } from "@clerk/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewerState } from "@/hooks/useViewerState";
import { useDestinationSettings } from "@/hooks/useDestinationSettings";

// ── Constants ───────────────────────────────────────────────────────

const ALL_TABS = ["Members", "Profile", "Webhooks", "Notifications"] as const;
const DEFAULT_TAB = "Profile";

// ── URL-synced tab hook ─────────────────────────────────────────────

function useTabSync(validTabs: readonly string[], defaultTab: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(requestedTab && validTabs.includes(requestedTab) ? requestedTab : defaultTab);

  useEffect(() => {
    if (!validTabs.includes(tab)) {
      setTab(defaultTab);
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  }, [tab, validTabs, searchParams, setSearchParams, defaultTab]);

  const onChange = useCallback(
    (nextTab: string) => {
      setTab(nextTab);
      const next = new URLSearchParams(searchParams);
      if (nextTab === defaultTab) {
        next.delete("tab");
      } else {
        next.set("tab", nextTab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, defaultTab],
  );

  return { tab, onChange };
}

// ── Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const entitlements = viewer?.entitlements;

  const { tab, onChange } = useTabSync(ALL_TABS, DEFAULT_TAB);
  
  // LAZY LOADING: Only trigger destination queries if the user is on the relevant tab
  const showDestinations = tab === "Webhooks" || tab === "Notifications";
  
  const { slack, webhook } = useDestinationSettings(
    currentOrg?.id,
    showDestinations && (entitlements?.canUseSlackDestinations ?? false),
    showDestinations && (entitlements?.canUseWebhookDestinations ?? false),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage organization and project settings"
        breadcrumbs={[{ label: "Management" }, { label: "Settings" }]}
      />

      <Tabs value={tab} onValueChange={onChange} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-secondary p-1 -mx-2 sm:mx-0 px-2 sm:px-0">
          {ALL_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="text-[10px] sm:text-xs whitespace-nowrap">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="Members">
          <PremiumFeatureBlock
            title="Team Collaboration"
            description="Upgrade your plan to invite team members to your organization and manage access together."
            hasAccess={entitlements?.canUseTeamCollaboration ?? false}
          >
            <OrganizationMembersWorkspaceContainer />
          </PremiumFeatureBlock>
        </TabsContent>

        <TabsContent value="Webhooks">
          <PremiumFeatureBlock
            title="Webhook Destinations"
            description="Upgrade your plan to configure custom webhook destinations for real-time alerts."
            hasAccess={entitlements?.canUseWebhookDestinations ?? false}
          >
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
          </PremiumFeatureBlock>
        </TabsContent>

        <TabsContent value="Notifications">
          <PremiumFeatureBlock
            title="Slack & Discord Notifications"
            description="Upgrade your plan to integrate with Slack and Discord and receive alerts directly in your channels."
            hasAccess={entitlements?.canUseSlackDestinations ?? false}
          >
            <SlackDestinationsPanel
              destinations={slack.destinations}
              canManage={slack.canManage}
              saving={slack.saving}
              testingId={slack.testingId}
              onCreate={slack.onCreate}
              onUpdate={slack.onUpdate}
              onTest={slack.onTest}
            />
          </PremiumFeatureBlock>
        </TabsContent>
      </Tabs>
    </div>
  );
}
