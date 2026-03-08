import { PageHeader } from "@/components/shared/PageHeader";
import { useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { Construction } from "lucide-react";

const tabs = ["Profile", "General", "API Keys", "Webhooks", "Notifications", "Audit Logs", "Danger Zone"];

export default function SettingsPage() {
  const [tab, setTab] = useState("Profile");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage organization and project settings"
        breadcrumbs={[{ label: "Management" }, { label: "Settings" }]}
      />

      <div className="flex gap-1 overflow-x-auto bg-secondary rounded-md p-0.5 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Profile" && <ProfileSettings />}

      {tab !== "Profile" && (
        <div className="glass-card p-12 text-center">
          <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {tab} settings are under development.
          </p>
        </div>
      )}
    </div>
  );
}
