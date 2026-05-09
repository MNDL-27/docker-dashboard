import { PageHeader } from "@/components/shared/PageHeader";
import { AlertTriangle, Clock, Users, GitBranch, ShieldAlert } from "lucide-react";

const upcomingFeatures = [
  { icon: Clock, title: "Incident Timeline", desc: "Chronological event tracking from detection through resolution." },
  { icon: Users, title: "Team Collaboration", desc: "Assign responders, add notes, and coordinate fixes in real time." },
  { icon: GitBranch, title: "Impacted Services", desc: "Automatic dependency mapping to identify blast radius." },
  { icon: AlertTriangle, title: "Alert Correlation", desc: "Group related alerts into unified incidents to reduce noise." },
];

export default function IncidentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Incidents"
        description="Track and resolve infrastructure incidents"
        breadcrumbs={[{ label: "Observability" }, { label: "Incidents" }]}
      />

      {/* Hero coming soon card */}
      <div className="glass-card p-10 text-center">
        <div className="rounded-xl bg-primary/10 p-4 mb-5 w-fit mx-auto">
          <ShieldAlert className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-2">Incident Management</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
          Incident tracking with timelines, impacted services, and team collaboration is under active development.
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
