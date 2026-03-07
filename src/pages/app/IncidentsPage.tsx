import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { incidents } from "@/lib/mock-data";
import { Link } from "react-router-dom";

export default function IncidentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incidents"
        description="Track and resolve infrastructure incidents"
        breadcrumbs={[{ label: "Observability" }, { label: "Incidents" }]}
      />

      <div className="space-y-3">
        {incidents.map(inc => (
          <Link key={inc.id} to={`/app/incidents/${inc.id}`} className="glass-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors block">
            <div className="flex items-center gap-3">
              <StatusBadge status={inc.severity} />
              <div>
                <div className="font-medium">{inc.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {inc.impactedHosts} host(s) • {inc.impactedContainers} container(s) • {inc.alerts} alert(s)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <StatusBadge status={inc.status} />
              <div className="text-right hidden md:block">
                <div className="text-xs text-muted-foreground">Assigned to {inc.assignee}</div>
                <div className="text-xs text-muted-foreground">Started {inc.startedAt}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
