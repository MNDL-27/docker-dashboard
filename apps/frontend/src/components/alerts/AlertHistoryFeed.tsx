import { Clock3, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AlertEvent, Incident } from "@/types/database";

export function AlertHistoryFeed({
  incidents,
  history,
}: {
  incidents: Incident[];
  history: Array<AlertEvent & { href?: string }>;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Recent Activity</h3>
        <p className="text-xs text-muted-foreground">Incident creation and alert lifecycle history for the active organization.</p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Open Incidents
          </div>
          <div className="space-y-3">
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents opened from alerts yet.</p>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{incident.title}</span>
                    <StatusBadge status={incident.status} />
                  </div>
                  {incident.summary ? <p className="text-sm text-muted-foreground">{incident.summary}</p> : null}
                  <div className="mt-2 text-xs text-muted-foreground">Opened {new Date(incident.opened_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Alert History
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alert history will appear here as signals are detected and resolved.</p>
            ) : (
              history.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{new Date(item.updated_at).toLocaleString()}</span>
                    <Link to={item.href || "/app/alerts"} className="text-primary hover:underline">Open resource</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
