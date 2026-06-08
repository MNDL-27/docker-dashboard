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
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24">
          <div className="absolute inset-0 hero-glow dark:hero-glow-dark opacity-50" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
          
          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-gradient">
              The Working Docker Operations Core
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Docker Dashboard focuses on the features that are already implemented well: host connectivity, container visibility, logs, and practical alerts.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 pb-24 relative z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div key={f.title} className="glass-card-interactive p-8 flex flex-col h-full animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 shrink-0">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">{f.title}</h2>
                  <p className="text-muted-foreground leading-relaxed mb-6 flex-1">
                    {f.desc}
                  </p>
                  <ul className="space-y-2 mt-auto pt-6 border-t border-border/50">
                    {f.details.map(d => (
                      <li key={d} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 relative z-10">
            <div className="glass-card-raised p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>
              
              <h2 className="text-3xl font-bold mb-4 relative z-10">Ready to take control of your hosts?</h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto relative z-10">
                Join thousands of developers managing their Docker infrastructure with Docker Dashboard.
              </p>
              <Link to={primaryHref} className="relative z-10">
                <Button size="lg" className="gap-2 px-8 h-12 text-base shadow-lg shadow-primary/20">
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
