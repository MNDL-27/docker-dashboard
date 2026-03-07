import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { alerts, alertRules } from "@/lib/mock-data";
import { Plus, Bell, BellOff } from "lucide-react";
import { useState } from "react";

export default function AlertsPage() {
  const [tab, setTab] = useState<"active" | "rules">("active");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Alerts"
        description="Alert rules and active alerts"
        breadcrumbs={[{ label: "Observability" }, { label: "Alerts" }]}
        actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Create Rule</Button>}
      />

      <div className="flex gap-1 bg-secondary rounded-md p-0.5 w-fit">
        <button onClick={() => setTab("active")} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Active Alerts ({alerts.filter(a => a.status === "firing").length})
        </button>
        <button onClick={() => setTab("rules")} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === "rules" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          Alert Rules ({alertRules.length})
        </button>
      </div>

      {tab === "active" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Alert</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Severity</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Host</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Container</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Rule</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Triggered</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="p-3 font-medium">{a.title}</td>
                  <td className="p-3"><StatusBadge status={a.severity} /></td>
                  <td className="p-3"><StatusBadge status={a.status} /></td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{a.host}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{a.container}</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell">{a.rule}</td>
                  <td className="p-3 text-muted-foreground">{a.triggeredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-2">
          {alertRules.map(r => (
            <div key={r.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.enabled ? "bg-primary/10" : "bg-muted"}`}>
                  {r.enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.condition} • {r.targets}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1">
                  {r.channels.map(ch => (
                    <span key={ch} className="text-xs bg-secondary px-2 py-0.5 rounded">{ch}</span>
                  ))}
                </div>
                <span className={`text-xs font-medium ${r.enabled ? "text-success" : "text-muted-foreground"}`}>
                  {r.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
