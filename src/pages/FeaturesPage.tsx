import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Server, Bell, FileText, Activity, Shield, Check, ArrowRight } from "lucide-react";

const features = [
  { icon: Server, title: "Multi-Host Fleet Management", desc: "Connect unlimited Docker hosts across regions, cloud providers, and on-premise infrastructure. See every host and container in one unified view.", details: ["Auto-discovery of containers", "Region and tag grouping", "Host health monitoring", "Agent auto-updates"] },
  { icon: Activity, title: "Real-Time Metrics", desc: "Track CPU, memory, network, and disk metrics per host and per container with 1-second granularity.", details: ["Time-series charts", "Custom dashboards", "Historical comparisons", "Export to Prometheus/Grafana"] },
  { icon: FileText, title: "Centralized Log Explorer", desc: "Search, filter, and tail logs from every container. Full-text search with severity, host, and time filters.", details: ["Live tail streaming", "Structured log parsing", "Log-to-incident linking", "Configurable retention"] },
  { icon: Bell, title: "Smart Alerting", desc: "Create alert rules for common failure modes. Route to Slack, email, PagerDuty, or webhooks.", details: ["Container exit alerts", "CPU/memory thresholds", "Restart loop detection", "Host offline detection"] },
  { icon: Shield, title: "Incident Management", desc: "Track incidents from detection to resolution. Full timeline, impacted services, and team collaboration.", details: ["Auto-create from alerts", "Severity classification", "Assign and escalate", "Post-mortem templates"] },
  { icon: Box, title: "Container Lifecycle", desc: "View container state, restart history, configuration, networking, volumes, and health checks.", details: ["One-click restart/stop", "Environment inspection", "Resource limits view", "Health check history"] },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"><Box className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-semibold tracking-tight">Docker Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/signup"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Everything you need to monitor Docker</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">From individual containers to large-scale fleets, Docker Dashboard gives your team full visibility and control.</p>
        </div>
        <div className="max-w-5xl mx-auto px-4 space-y-12">
          {features.map((f, i) => (
            <div key={f.title} className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
              <div className="flex-1 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{f.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                <ul className="space-y-2">
                  {f.details.map(d => (
                    <li key={d} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success shrink-0" />{d}</li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 glass-card h-48 flex items-center justify-center">
                <f.icon className="h-16 w-16 text-muted-foreground/20" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 text-center">
        <Link to="/signup"><Button size="lg" className="gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></Button></Link>
      </section>
    </div>
  );
}
