import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiKeys, auditLogs } from "@/lib/mock-data";
import { Plus, Key, Copy, Trash2, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

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

      {tab === "General" && (
        <div className="space-y-6 max-w-lg">
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-medium">Organization Settings</h3>
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input defaultValue="Acme Cloud" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input defaultValue="acme-cloud" />
            </div>
            <Button size="sm">Save Changes</Button>
          </div>
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-medium">Project Settings</h3>
            <div className="space-y-2">
              <Label>Default Project</Label>
              <Input defaultValue="Production Cluster" />
            </div>
            <div className="space-y-2">
              <Label>Default Environment</Label>
              <Input defaultValue="production" />
            </div>
            <Button size="sm">Save Changes</Button>
          </div>
        </div>
      )}

      {tab === "API Keys" && (
        <div className="space-y-4">
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Create API Key</Button>
          <div className="space-y-2">
            {apiKeys.map(k => (
              <div key={k.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{k.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{k.prefix}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-1">
                    {k.scopes.map(s => (
                      <span key={s} className="text-xs bg-secondary px-2 py-0.5 rounded capitalize">{s}</span>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Used {k.lastUsed}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Copy className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Audit Logs" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Action</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Actor</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Target</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">When</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(l => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs">{l.action}</td>
                  <td className="p-3">{l.actor}</td>
                  <td className="p-3 text-muted-foreground">{l.target}</td>
                  <td className="p-3 text-muted-foreground">{l.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Webhooks" && (
        <div className="glass-card p-6 text-center py-12">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No webhooks configured</h3>
          <p className="text-sm text-muted-foreground mb-4">Send real-time events to external services.</p>
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Webhook</Button>
        </div>
      )}

      {tab === "Notifications" && (
        <div className="space-y-4 max-w-lg">
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Notification Channels</h3>
            {["Email — sarah@acmecloud.io", "Slack — #ops-alerts", "PagerDuty — On-call rotation"].map(ch => (
              <div key={ch} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{ch}</span>
                <Button variant="ghost" size="sm">Configure</Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Channel</Button>
        </div>
      )}

      {tab === "Danger Zone" && (
        <div className="glass-card border-destructive/30 p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-medium">Danger Zone</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">Transfer Organization</div>
                <div className="text-xs text-muted-foreground">Transfer ownership to another member</div>
              </div>
              <Button variant="outline" size="sm">Transfer</Button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">Delete Organization</div>
                <div className="text-xs text-muted-foreground">Permanently delete this organization and all data</div>
              </div>
              <Button variant="destructive" size="sm">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
