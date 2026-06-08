import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, Server, KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { SEO } from "@/components/shared/SEO";

const items = [
  {
    icon: Lock,
    title: "Encrypted Secret Storage",
    desc: "Stored host credentials are encrypted before they are written to the application database, with support for key rotation.",
    highlights: ["AES-256 encryption at rest", "Automated key rotation", "Zero plaintext persistence"],
  },
  {
    icon: Shield,
    title: "Organization-Scoped Access",
    desc: "Backend API access is resolved against the active organization, with owner and admin checks on write actions.",
    highlights: ["Role-based access control", "Owner & admin write gates", "Org-scoped data isolation"],
  },
  {
    icon: Eye,
    title: "Docker Socket Stays Behind the Agent",
    desc: "The hosted control plane talks to the Watchtower Agent instead of reaching the Docker socket directly.",
    highlights: ["No public socket exposure", "Agent-mediated commands", "Reduced attack surface"],
  },
  {
    icon: Server,
    title: "Shared Responsibility Model",
    desc: "You operate the hosts and agent endpoints; Docker Dashboard provides the management plane, access control, and connectivity workflows.",
    highlights: ["Clear trust boundary", "Your hosts, your rules", "Managed control plane"],
  },
  {
    icon: KeyRound,
    title: "Per-Host Agent Credentials",
    desc: "Each host can use its own agent API key and optional Cloudflare access credentials for tunnel-based deployments.",
    highlights: ["Unique keys per host", "Cloudflare Tunnel support", "Revocable credentials"],
  },
];

export default function SecurityPage() {
  const primaryHref = isPreviewAuthBypassEnabled() ? "/app" : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Security"
        description="Our multi-layered security model ensures your Docker infrastructure stays private. AES-256 encryption, per-host API keys, and zero-trust Cloudflare Tunnels."
      />
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-24">
          <div className="absolute inset-0 hero-glow dark:hero-glow-dark opacity-50" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />

          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
              <Shield className="h-4 w-4" />
              Security First
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-gradient">
              Built on Concrete Controls
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Every layer of Docker Dashboard is designed around the principle that your infrastructure credentials and runtime data stay under your control.
            </p>
          </div>
        </section>

        {/* Security Items */}
        <section className="py-12 pb-24 relative z-10">
          <div className="max-w-5xl mx-auto px-4 space-y-6">
            {items.map((item, i) => (
              <div
                key={item.title}
                className="glass-card-interactive p-8 flex flex-col md:flex-row items-start gap-6 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>

                <div className="flex-1 space-y-3">
                  <h2 className="text-xl font-bold">{item.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {item.highlights.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 relative z-10">
            <div className="glass-card-raised p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none" />

              <h2 className="text-3xl font-bold mb-4 relative z-10">
                Secure your fleet today
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto relative z-10">
                Start managing your Docker hosts with enterprise-grade security — no credit card required.
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
