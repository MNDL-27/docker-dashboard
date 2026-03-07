import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deployments } from "@/lib/mock-data";

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Deployments"
        description="Deployment history and release tracking"
        breadcrumbs={[{ label: "Operations" }, { label: "Deployments" }]}
      />
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Image</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Host</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Deployed By</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Duration</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">When</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map(d => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <td className="p-3 font-mono text-xs">{d.image}</td>
                <td className="p-3 text-muted-foreground">{d.host}</td>
                <td className="p-3"><StatusBadge status={d.status} /></td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{d.deployedBy}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{d.duration}</td>
                <td className="p-3 text-muted-foreground">{d.deployedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
