import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Box, Server, Bell, FileText, Activity, Shield, Users, ArrowRight, Check, ChevronDown } from "lucide-react";

const plans = [
  { id: "free", name: "Free", price: 0, features: ["2 hosts", "1 user", "24h data retention", "Basic alerts", "Community support"] },
  { id: "pro", name: "Pro", price: 29, features: ["10 hosts", "5 users", "7-day retention", "Advanced alerts", "Email support", "API access"] },
  { id: "team", name: "Team", price: 79, features: ["50 hosts", "25 users", "30-day retention", "Custom dashboards", "Priority support", "SSO", "Audit logs"] },
  { id: "enterprise", name: "Enterprise", price: -1, features: ["Unlimited hosts", "Unlimited users", "Custom retention", "Dedicated support", "SLA", "On-premise option", "Custom integrations"] },
];

const features = [
  { icon: Server, title: "Multi-Host Monitoring", desc: "Monitor all your Docker hosts from a single pane of glass. Real-time metrics, health checks, and resource tracking." },
  { icon: Bell, title: "Smart Alerts", desc: "Set up alert rules for container failures, resource thresholds, restart loops, and host connectivity issues." },
  { icon: FileText, title: "Centralized Logs", desc: "Stream and search logs from every container across all your hosts. Filter by severity, host, and time range." },
  { icon: Activity, title: "Incident Management", desc: "Track, investigate, and resolve incidents with full timeline, impacted services, and team collaboration." },
  { icon: Users, title: "Team Collaboration", desc: "Invite your team with role-based access. Owner, admin, developer, and viewer roles with audit trails." },
  { icon: Shield, title: "Self-Hosted Agent", desc: "Your data stays on your infrastructure. Our lightweight agent connects securely to the SaaS control plane." },
];

const logos = ["Acme Corp", "TechStack", "DevOps Inc", "CloudNine", "Infra.io", "ScaleUp"];

const faqs = [
  { q: "How does the agent work?", a: "Install our lightweight Docker container on any host. It securely reports metrics, logs, and events to your Docker Dashboard. No inbound ports needed — the agent initiates all connections." },
  { q: "Is my data secure?", a: "Absolutely. The agent uses TLS-encrypted outbound connections. Your container data never leaves your infrastructure except for the metrics and logs you choose to send." },
  { q: "What Docker versions are supported?", a: "Docker Engine 20.10+ and Docker Desktop 4.x+. We support Linux, macOS, and Windows hosts." },
  { q: "Can I self-host the entire platform?", a: "We offer an Enterprise plan with self-hosted deployment options. Contact sales for details." },
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Docker Dashboard</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/security" className="text-muted-foreground hover:text-foreground transition-colors">Security</Link>
            <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/login"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            Now monitoring 50,000+ containers
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Monitor your Docker fleet<br />
            <span className="text-gradient">from one control plane</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Install our lightweight agent on your Docker hosts. Get real-time metrics, 
            centralized logs, smart alerts, and incident management — all from a beautiful SaaS dashboard.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/login"><Button size="lg" className="gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/contact"><Button size="lg" variant="outline">Book a Demo</Button></Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Free tier includes 2 hosts. No credit card required.</p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border py-12 bg-card/30">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {logos.map(l => (
              <span key={l} className="text-muted-foreground/50 font-semibold text-lg">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Everything you need to monitor Docker</h2>
            <p className="text-muted-foreground">From single-host setups to large-scale container fleets.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="glass-card p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-16 bg-card/30 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50K+", label: "Containers monitored" },
            { value: "2,000+", label: "Teams" },
            { value: "99.99%", label: "Uptime SLA" },
            { value: "<1s", label: "Metric latency" },
          ].map(m => (
            <div key={m.label}>
              <div className="text-3xl font-bold text-gradient">{m.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Scale as you grow.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {plans.map(p => (
              <div key={p.id} className={`glass-card p-6 space-y-4 ${p.id === "team" ? "ring-2 ring-primary" : ""}`}>
                {p.id === "team" && <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Most Popular</span>}
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <div className="text-3xl font-bold">
                  {p.price === -1 ? "Custom" : p.price === 0 ? "$0" : `$${p.price}`}
                  {p.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
                <ul className="space-y-2">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/login">
                  <Button className="w-full" variant={p.id === "team" ? "default" : "outline"} size="sm">
                    {p.price === -1 ? "Contact Sales" : "Get Started"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-card/30 border-t border-border">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(f => (
              <details key={f.q} className="glass-card p-4 group">
                <summary className="flex items-center justify-between cursor-pointer font-medium text-sm list-none">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to monitor your Docker infrastructure?</h2>
          <p className="text-muted-foreground mb-8">Get started in under 5 minutes. No credit card required.</p>
          <Link to="/login"><Button size="lg" className="gap-2">Start Free <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card/30">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="h-4 w-4 text-primary" />
            <span>© 2024 Docker Dashboard. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/security" className="hover:text-foreground transition-colors">Security</Link>
            <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
