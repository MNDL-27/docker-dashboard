import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitPullRequest, History, RefreshCw, Rocket, Tag } from "lucide-react";
import { Link } from "react-router-dom";

const upcomingFeatures = [
  { icon: History, title: "Deployment History", desc: "Audit trail for updates, restarts, and rollbacks across hosts." },
  { icon: Tag, title: "Release Tracking", desc: "Track image tags, digests, and rollout targets per service." },
  { icon: RefreshCw, title: "Rollback Support", desc: "One-click rollback to previous versions with safety checks." },
  { icon: GitPullRequest, title: "CI/CD Integration", desc: "Link pipelines to provide deploy metadata and approvals." },
];

const rolloutSteps = [
  {
    label: "Capture image metadata",
    detail: "Detect tags and digests at deploy time from the agent.",
    status: "In design",
  },
  {
    label: "Track rollout window",
    detail: "Measure deployment duration and impact on fleet health.",
    status: "Planned",
  },
  {
    label: "Enable safe rollback",
    detail: "Allow revert to previous image with change annotations.",
    status: "Planned",
  },
];

const sampleReleases = [
  { id: "rel-204", service: "payments-api", version: "v2.9.3", status: "Queued", target: "2 hosts" },
  { id: "rel-203", service: "web-frontend", version: "v1.14.0", status: "Completed", target: "6 hosts" },
  { id: "rel-202", service: "worker-core", version: "v4.1.1", status: "Completed", target: "4 hosts" },
];

export default function DeploymentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Deployments"
        description="Release tracking and deployment history across your fleet"
        breadcrumbs={[{ label: "Operations" }, { label: "Deployments" }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">Preview</Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/containers">View containers</Link>
            </Button>
          </div>
        }
      />

      <div className="glass-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Deployment control plane</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                Deployment tracking is being built to correlate container updates with fleet health and alert activity.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Roadmap Q2</Badge>
            <Button asChild>
              <Link to="/app/containers">Prepare container inventory</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold tracking-tight">Latest release activity</h4>
              <p className="text-xs text-muted-foreground">Sample release queue and status timeline.</p>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">Demo</Badge>
          </div>
          <div className="mt-6 space-y-3">
            {sampleReleases.map((release) => (
              <div key={release.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{release.service}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{release.version}</div>
                  <div className="text-xs text-muted-foreground">Target: {release.target}</div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {release.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold tracking-tight">Deployment readiness</h4>
            </div>
            <div className="mt-4 space-y-3">
              {rolloutSteps.map((step) => (
                <div key={step.label} className="rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">{step.label}</div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold tracking-tight">Next capabilities</h4>
            </div>
            <div className="mt-4 grid gap-3">
              {upcomingFeatures.map((feature) => (
                <div key={feature.title} className="flex gap-3 rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary h-fit">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{feature.title}</div>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
