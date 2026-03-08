import { PageHeader } from "@/components/shared/PageHeader";
import { Construction } from "lucide-react";

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Deployments"
        description="Deployment history and release tracking"
        breadcrumbs={[{ label: "Operations" }, { label: "Deployments" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Deployment history and release tracking for your Docker containers is under development.
        </p>
      </div>
    </div>
  );
}
