import { PageHeader } from "@/components/shared/PageHeader";
import { Rocket, History, Tag, RefreshCw, GitPullRequest } from "lucide-react";

const upcomingFeatures = [
  { icon: History, title: "Deployment History", desc: "Full audit log of every container update, rollback, and restart." },
  { icon: Tag, title: "Release Tracking", desc: "Track image tags and versions across hosts and environments." },
  { icon: RefreshCw, title: "Rollback Support", desc: "One-click rollback to any previous container version." },
  { icon: GitPullRequest, title: "CI/CD Integration", desc: "Connect deployment pipelines for automated tracking." },
];

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Deployments"
        description="Deployment history and release tracking"
        breadcrumbs={[{ label: "Operations" }, { label: "Deployments" }]}
      />

      {/* Hero coming soon card */}
      <div className="glass-card p-10 text-center">
        <div className="rounded-xl bg-primary/10 p-4 mb-5 w-fit mx-auto">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-2">Deployment Tracking</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
          Deployment history and release tracking for your Docker containers is under active development.
        </p>

        {/* Feature preview grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {upcomingFeatures.map((feature) => (
            <div
              key={feature.title}
              className="glass-card-interactive p-4 text-left flex gap-3"
            >
              <div className="rounded-lg bg-primary/10 p-2 h-fit shrink-0">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-0.5">{feature.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
