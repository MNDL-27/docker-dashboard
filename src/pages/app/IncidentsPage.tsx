import { PageHeader } from "@/components/shared/PageHeader";
import { Construction } from "lucide-react";

export default function IncidentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incidents"
        description="Track and resolve infrastructure incidents"
        breadcrumbs={[{ label: "Observability" }, { label: "Incidents" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Incident tracking with timelines, impacted services, and team collaboration is under development.
        </p>
      </div>
    </div>
  );
}
