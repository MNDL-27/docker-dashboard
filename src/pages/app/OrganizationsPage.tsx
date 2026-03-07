import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { organizations, projects } from "@/lib/mock-data";
import { Link } from "react-router-dom";
import { Building2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function OrganizationsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Organizations"
        description="Manage your workspaces and projects"
        breadcrumbs={[{ label: "Organizations" }]}
        actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />New Organization</Button>}
      />

      <div className="space-y-4">
        {organizations.map(org => (
          <div key={org.id} className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{org.name}</h3>
                  <div className="text-xs text-muted-foreground">{org.slug} • {org.members} members • {org.hosts} hosts</div>
                </div>
              </div>
              <StatusBadge status={org.plan === "team" ? "warning" : "info"} className="capitalize"  />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {projects.filter(p => p.orgId === org.id).map(proj => (
                <Link key={proj.id} to="/app" className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors">
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{proj.name}</div>
                    <div className="text-xs text-muted-foreground">{proj.hosts} hosts • {proj.containers} containers</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
