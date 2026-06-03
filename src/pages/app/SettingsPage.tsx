import { PageHeader } from "@/components/shared/PageHeader";
import { useCallback, useEffect, useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { useSearchParams } from "react-router-dom";
import { DesktopNotificationSettings } from "@/components/settings/DesktopNotificationSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Constants ───────────────────────────────────────────────────────

const ALL_TABS = ["Profile", "Notifications"] as const;
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
  const { tab, onChange } = useTabSync(ALL_TABS, DEFAULT_TAB);

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

        <TabsContent value="Notifications" className="space-y-6 outline-none pt-2">
          <DesktopNotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
