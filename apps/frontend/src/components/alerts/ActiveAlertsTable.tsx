import { Loader2, ShieldPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AlertEvent } from "@/types/database";

type AlertRow = AlertEvent & { href?: string };

function formatEventTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function describeResource(alert: AlertRow) {
  const metadata = alert.metadata ?? {};
  const hostName = typeof metadata.host_name === "string" ? metadata.host_name : null;
  const containerName = typeof metadata.container_name === "string" ? metadata.container_name : null;

  if (containerName && hostName) return `${containerName} on ${hostName}`;
  if (hostName) return hostName;
  return alert.source_ref;
}

export function ActiveAlertsTable({
  alerts,
  canManage,
  onAcknowledge,
  onResolve,
  onCreateIncident,
  pendingId,
}: {
  alerts: AlertRow[];
  canManage: boolean;
  pendingId?: string | null;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onCreateIncident: (alert: AlertRow) => void;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Active Alerts</h3>
          <p className="text-xs text-muted-foreground">Persisted alert state with acknowledgement, resolution, and incident escalation.</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Alert</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Affected Resource</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                No alerts match the current view.
              </TableCell>
            </TableRow>
          ) : (
            alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell className="space-y-1">
                  <div className="font-medium">{alert.title}</div>
                  <div className="max-w-xl text-xs text-muted-foreground">{alert.message}</div>
                  <Link to={alert.href || "/app/alerts"} className="text-xs text-primary hover:underline">
                    Open affected resource
                  </Link>
                </TableCell>
                <TableCell><StatusBadge status={alert.severity} /></TableCell>
                <TableCell><StatusBadge status={alert.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{describeResource(alert)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatEventTime(alert.last_seen_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {canManage ? (
                      <>
                        {alert.status === "open" ? (
                          <Button size="sm" variant="outline" onClick={() => onAcknowledge(alert.id)} disabled={pendingId === alert.id}>
                            {pendingId === alert.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Acknowledge
                          </Button>
                        ) : null}
                        {alert.status !== "resolved" ? (
                          <Button size="sm" variant="outline" onClick={() => onResolve(alert.id)} disabled={pendingId === alert.id}>
                            Resolve
                          </Button>
                        ) : null}
                        {!alert.incident_id ? (
                          <Button size="sm" onClick={() => onCreateIncident(alert)} disabled={pendingId === alert.id}>
                            <ShieldPlus className="mr-1.5 h-3.5 w-3.5" />
                            Incident
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read only</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
