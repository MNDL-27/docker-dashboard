import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Box, Server, Bell, FileText, Activity, Shield, Users, ArrowRight, Check, Terminal, Zap, Eye, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { SEO } from "@/components/shared/SEO";

function TerminalDemo() {
  return (
    <div className="terminal-block p-5 text-left w-full max-w-2xl mx-auto shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-[11px] text-muted-foreground font-mono">prod-server-01</span>
      </div>
      <div className="space-y-1.5 text-[13px]">
        <div><span className="prompt">$</span> <span className="text-foreground/90">curl -fsSL https://app.dockerdash.app/install.sh | sudo bash</span></div>
        <div className="comment"># Installing watchtower-agent v1.0.1...</div>
        <div className="comment"># ✓ Created service account</div>
        <div className="comment"># ✓ Installed runtime to /opt/watchtower-agent/</div>
        <div className="comment"># ✓ Enabled systemd service</div>
        <div className="text-green-400">✓ Agent is running. Reporting to DockerDash.</div>
        <div className="mt-2"><span className="prompt">$</span> <span className="text-foreground/90 animate-pulse">_</span></div>
      </div>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const primaryHref = isPreviewAuthBypassEnabled() ? "/app" : "/sign-up";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Fleet Monitoring for Self-Hosted Docker" 
        description="One control plane for your entire Docker fleet. Real-time host metrics, container logs, and smart alerts — without exposing your Docker socket to the cloud."
      />
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 hero-glow pointer-events-none" />
          <div className="absolute inset-0 bg-grid grid-fade pointer-events-none opacity-40" />

          <div className="max-w-5xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-semibold tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
                Public Beta — Free for 1 host
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
                <span className="bg-gradient-to-b from-foreground via-foreground to-foreground/50 bg-clip-text text-transparent">
                  One dashboard for{" "}
                </span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
                  every Docker host
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Install a 4 MB agent on each host. Get container metrics, logs, and alerts
                in a shared control plane — without punching holes in your firewall
                or giving us your Docker socket.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link to={primaryHref}>
                  <Button size="lg" className="h-12 px-7 text-base font-semibold gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                    Start monitoring free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/docs">
                  <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border/60">
                    Read the docs
                  </Button>
                </Link>
              </div>
            </div>

            {/* Terminal demo instead of screenshot */}
            <div className="mt-16 relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-2xl pointer-events-none" />
              <TerminalDemo />
            </div>
          </div>
        </section>

        {/* How it works — 3 steps, not a generic feature grid */}
        <section className="py-20 border-y border-border/60">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">How it works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Three steps to fleet visibility</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  icon: Terminal,
                  title: "Install the agent",
                  desc: "One curl command per host. The agent runs as a systemd service, connects outbound, and uses ~12 MB of RAM.",
                },
                {
                  step: "02",
                  icon: Eye,
                  title: "See everything",
                  desc: "Container state, CPU/memory/disk/network per host, live log streaming, Docker version and image digests — updated every 10 seconds.",
                },
                {
                  step: "03",
                  icon: Bell,
                  title: "Get alerted",
                  desc: "Set thresholds for CPU, memory, disk, or container failures. Alerts fire in-app with email notifications coming soon.",
                },
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="glass-card-interactive p-6 h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[11px] font-extrabold text-primary/50 tracking-wider">{item.step}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features — asymmetric layout, not a uniform grid */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Capabilities</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">What you get out of the box</h2>
            </div>

            {/* Two-column feature layout */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Large card */}
              <div className="glass-card-interactive p-6 md:row-span-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Multi-host monitoring</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Real-time CPU, memory, disk, and network metrics for every host. 
                  Health checks run every 60 seconds with automatic status escalation — 
                  3 consecutive failures mark a host as unhealthy.
                </p>
                <ul className="space-y-2">
                  {["Per-host resource graphs", "Docker version tracking", "Agent version & update prompts", "Cloudflare Tunnel support"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Stacked smaller cards */}
              <div className="glass-card-interactive p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Centralized log streaming</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Stream stdout/stderr from any container across any host. Filter by container, host, or time range.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card-interactive p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Team access controls</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Invite your team with role-based access. Owner, admin, developer, and viewer roles with per-org isolation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Second row — 3 compact cards */}
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {[
                { icon: Bell, title: "Smart alerts", desc: "Container failures, resource thresholds, host connectivity — configurable per-org." },
                { icon: Shield, title: "Your infra, your data", desc: "Agents connect outbound. We never touch your Docker socket or SSH into your hosts." },
                { icon: Activity, title: "Fleet-wide metrics", desc: "Aggregate CPU, memory, and container counts across your entire fleet in one chart." },
              ].map((f, i) => (
                <div key={i} className="glass-card-interactive p-5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof / stats */}
        <section className="py-16 border-y border-border/60 bg-card/30">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              <StatBlock value="4 MB" label="Agent footprint" />
              <StatBlock value="<12 MB" label="Runtime memory" />
              <StatBlock value="10s" label="Metric refresh" />
              <StatBlock value="60s" label="Health check interval" />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Stop SSHing into boxes to check uptime</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Free tier includes 1 host, 1 team member, and limited log retention. 
              No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to={primaryHref}>
                <Button size="lg" className="h-12 px-8 text-base font-semibold gap-2 shadow-lg shadow-primary/20">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-border/60">
                  Compare plans
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
