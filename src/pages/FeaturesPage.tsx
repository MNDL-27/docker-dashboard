import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Server, Bell, FileText, Shield, Check, ArrowRight, Boxes, Users } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { SEO } from "@/components/shared/SEO";

const features = [
  { icon: Server, title: "Host Inventory", desc: "Register Docker hosts through the guided setup flow and keep connectivity status visible in one workspace.", details: ["Agent connectivity checks", "Host health status", "Stored agent version", "Cloudflare Tunnel support"] },
  { icon: Boxes, title: "Container Visibility", desc: "Browse containers across connected hosts and inspect runtime details without logging into each machine.", details: ["Cross-host container list", "Inspect metadata", "Restart, stop, and start actions", "Environment and networking views"] },
  { icon: FileText, title: "On-Demand Logs", desc: "Fetch recent container logs for debugging and filter them in the UI when you need to investigate quickly.", details: ["Per-container log fetch", "Timestamped output", "Client-side filtering", "Recent host-aware troubleshooting"] },
  { icon: Bell, title: "Alert Rules", desc: "Define practical alert rules for host and container issues, then route them to Slack or signed webhooks.", details: ["Host offline alerts", "Container exited alerts", "CPU and memory thresholds", "Slack and webhook delivery"] },
  { icon: Users, title: "Organization Workspaces", desc: "Keep each team in a separate organization with role-based access to hosts, settings, and alerts.", details: ["Owner, admin, and member roles", "Clerk-backed organization access", "Organization-scoped data", "Member management workspace"] },
  { icon: Shield, title: "Secure Agent Model", desc: "The control plane talks to a lightweight agent instead of exposing the Docker socket directly to the public internet.", details: ["Encrypted stored secrets", "Per-host agent API keys", "Optional tunnel credentials", "Backend-enforced organization access"] },
];

export default function FeaturesPage() {
  const primaryHref = isPreviewAuthBypassEnabled() ? "/app" : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Features" 
        description="Explore the tools built for modern Docker fleet management. Centralized monitoring, logs, alerts, and enterprise-grade security."
      />
      <PublicNavbar />

      <main className="flex-1">
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">The working Docker operations core</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Docker Dashboard focuses on the features that are already implemented well: host connectivity, container visibility, logs, and practical alerts.</p>
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
          <Link to={primaryHref}><Button size="lg" className="gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></Button></Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
