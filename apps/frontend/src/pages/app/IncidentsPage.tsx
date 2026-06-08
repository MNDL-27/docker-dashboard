import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, GitBranch, ShieldAlert, Users } from "lucide-react";
import { Link } from "react-router-dom";

const previewHighlights = [
  { icon: Clock, title: "Incident Timeline", desc: "Chronological event tracking from detection through mitigation." },
  { icon: Users, title: "Team Collaboration", desc: "Assign responders, add context, and coordinate fixes in real time." },
  { icon: GitBranch, title: "Impacted Services", desc: "Automatic dependency mapping to identify blast radius." },
  { icon: AlertTriangle, title: "Alert Correlation", desc: "Group related alerts into unified incident workflows." },
];

const readinessSteps = [
  {
    label: "Confirm alert rules",
    detail: "Make sure CPU, memory, and host heartbeat rules are active before triage runs.",
    status: "Ready",
  },
  {
    label: "Set escalation ownership",
    detail: "Define who on-call should acknowledge and resolve incidents.",
    status: "Planned",
  },
  {
    label: "Build response playbooks",
    detail: "Document first-response steps so incidents move quickly.",
    status: "Draft",
  },
];

const sampleTimeline = [
  { time: "08:42", title: "CPU spike detected", desc: "Fleet CPU exceeded 85% for 5m." },
  { time: "08:43", title: "Incident created", desc: "Auto-grouped 3 alert signals into one event." },
  { time: "08:49", title: "Responder assigned", desc: "Primary engineer accepted the incident." },
  { time: "08:58", title: "Mitigation in progress", desc: "Restarted two workers; telemetry stabilizing." },
];

export default function IncidentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incidents"
        description="Track, coordinate, and resolve critical infrastructure events"
        breadcrumbs={[{ label: "Observability" }, { label: "Incidents" }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">Preview</Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/alerts">View alerts</Link>
            </Button>
          </div>
        }
      />

      <div className="glass-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Incident command center</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                The incident workflow is in active development. This preview outlines how critical alerts will roll into coordinated response timelines.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Roadmap Q2</Badge>
            <Button asChild>
              <Link to="/app/alerts">Prepare alert rules</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold tracking-tight">Sample incident timeline</h4>
              <p className="text-xs text-muted-foreground">Live response snapshots will appear here once enabled.</p>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">Demo</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {sampleTimeline.map((item, index) => (
              <div key={item.time} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  {index < sampleTimeline.length - 1 ? <div className="h-full w-px bg-border" /> : null}
                </div>
                <div className="flex-1 rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.time}</div>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest">Signal</Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold tracking-tight">Response readiness</h4>
            </div>
            <div className="mt-4 space-y-3">
              {readinessSteps.map((step) => (
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
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold tracking-tight">Next capabilities</h4>
            </div>
            <div className="mt-4 grid gap-3">
              {previewHighlights.map((feature) => (
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
