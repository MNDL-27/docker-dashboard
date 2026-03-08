import { PageHeader } from "@/components/shared/PageHeader";
import { Construction } from "lucide-react";

export default function MonitoringPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Resource utilization and performance metrics"
        breadcrumbs={[{ label: "Observability" }, { label: "Monitoring" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Aggregated monitoring dashboards with real-time CPU, memory, network, and disk metrics from your connected Docker hosts are under development.
        </p>
      </div>
    </div>
  );
}
