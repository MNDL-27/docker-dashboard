import { PageHeader } from "@/components/shared/PageHeader";
import { Construction } from "lucide-react";

export default function AlertsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Alerts"
        description="Alert rules and active alerts"
        breadcrumbs={[{ label: "Observability" }, { label: "Alerts" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Alert rules for container failures, resource thresholds, restart loops, and host connectivity issues are under development.
        </p>
      </div>
    </div>
  );
}
