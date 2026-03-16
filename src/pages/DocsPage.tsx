import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, BookOpen, Terminal, Server, Bell } from "lucide-react";

const sections = [
  { icon: BookOpen, title: "Getting Started", desc: "Install the agent and connect your first host in under 5 minutes.", links: ["Quick Start Guide", "Agent Installation", "First Dashboard"] },
  { icon: Terminal, title: "Agent Reference", desc: "Configuration, environment variables, and troubleshooting.", links: ["Agent Configuration", "Docker Compose Setup", "Kubernetes Deployment", "Troubleshooting"] },
  { icon: Server, title: "API Reference", desc: "REST API documentation for automation and integrations.", links: ["Authentication", "Hosts API", "Containers API", "Alerts API", "Webhooks"] },
  { icon: Bell, title: "Integrations", desc: "Connect Docker Dashboard to your existing tools.", links: ["Slack", "PagerDuty", "Datadog Export", "Prometheus", "Grafana"] },
];

export default function DocsPage() {
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
            <Link to="/login"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Documentation</h1>
            <p className="text-lg text-muted-foreground">Everything you need to get started and scale.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {sections.map(s => (
              <div key={s.title} className="glass-card p-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-semibold text-lg mb-2">{s.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
                <ul className="space-y-1.5">
                  {s.links.map(l => (
                    <li key={l}><span className="text-sm text-primary hover:underline cursor-pointer">{l}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
