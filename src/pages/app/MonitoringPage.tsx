import { PageHeader } from "@/components/shared/PageHeader";
import { Cpu, BarChart3, Activity, HardDrive, Gauge } from "lucide-react";

const upcomingFeatures = [
  { icon: Cpu, title: "CPU & Memory", desc: "Real-time utilization metrics across all hosts with threshold alerts." },
  { icon: BarChart3, title: "Historical Trends", desc: "Track resource consumption over time with interactive charts." },
  { icon: Activity, title: "Network I/O", desc: "Monitor bandwidth, packet loss, and connection counts per container." },
  { icon: HardDrive, title: "Disk & Volumes", desc: "Storage utilization and growth predictions for mounted volumes." },
];

export default function MonitoringPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Resource utilization and performance metrics"
        breadcrumbs={[{ label: "Observability" }, { label: "Monitoring" }]}
      />

      {/* Hero coming soon card */}
      <div className="glass-card p-10 text-center">
        <div className="rounded-xl bg-primary/10 p-4 mb-5 w-fit mx-auto">
          <Gauge className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold tracking-tight mb-2">Monitoring Dashboard</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
          Aggregated monitoring dashboards with real-time CPU, memory, network, and disk metrics from your connected Docker hosts are under active development.
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
