import { Link } from "react-router-dom";
import { LogoLink } from "@/components/shared/LogoLink";
import { Button } from "@/components/ui/button";
import {
  Box,
  BookOpen,
  Server,
  Activity,
  ArrowRight,
  Terminal,
  Users,
  FileText,
  HelpCircle,
  Construction,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  CloudCog,
  LayoutDashboard,
  Cable,
} from "lucide-react";
import { useState, useEffect } from "react";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { SEO } from "@/components/shared/SEO";

/*
 * ────────────────────────────────────────────────────────────
 *  Task-oriented documentation.
 *
 *  Every section is written as a how-to guide grounded in what
 *  the product actually does today, verified against source code.
 *
 *  Source evidence:
 *    OnboardingPage.tsx, DashboardPage.tsx, HostsPage.tsx,
 *    HostDetailPage.tsx, ContainersPage.tsx, ContainerDetailPage.tsx,
 *    LogsPage.tsx, OrganizationsPage.tsx, MembersPage.tsx,
 *    AddHostDialog.tsx, useDocker.ts, docker-api.ts, database.ts,
 *    App.tsx, MonitoringPage.tsx, AlertsPage.tsx, IncidentsPage.tsx,
 *    DeploymentsPage.tsx, BillingPage.tsx, SettingsPage.tsx
 * ────────────────────────────────────────────────────────────
 */

/* ── Table of Contents ── */
const TOC = [
  { id: "start-here", label: "Start Here", icon: BookOpen },
  { id: "how-connection-works", label: "How the Connection Works", icon: Cable },
  { id: "connect-host", label: "Connect Your First Host", icon: Server },
  { id: "dashboard", label: "Use the Dashboard", icon: LayoutDashboard },
  { id: "containers", label: "Containers", icon: Activity },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "organizations", label: "Organizations & Access", icon: Users },
  { id: "troubleshooting", label: "Troubleshooting", icon: HelpCircle },
  { id: "limitations", label: "Current Limitations", icon: Construction },
];

/* ── Reusable callout component ── */
function Callout({
  type,
  title,
  children,
}: {
  type: "info" | "success" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-primary/30 bg-primary/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
  };
  const icons = {
    info: <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 ${styles[type]}`}>
      {icons[type]}
      <div>
        <div className="text-sm font-medium mb-1">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ── Step block ── */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {n}
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      <div className="pb-8 min-w-0">
        <h4 className="text-sm font-semibold mb-2">{title}</h4>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/* ── Troubleshooting row ── */
function TroubleshootRow({
  problem,
  cause,
  fix,
}: {
  problem: string;
  cause: string;
  fix: string;
}) {
  return (
    <details className="glass-card p-4 group">
      <summary className="flex items-center justify-between cursor-pointer font-medium text-sm list-none">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          {problem}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform shrink-0 ml-4" />
      </summary>
      <div className="mt-3 ml-[22px] space-y-2 text-sm">
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Likely cause
          </span>
          <p className="text-muted-foreground">{cause}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            What to do
          </span>
          <p className="text-muted-foreground">{fix}</p>
        </div>
      </div>
    </details>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("start-here");
  const authHref = isPreviewAuthBypassEnabled() ? "/app" : "/login";

  /* Intersection observer for TOC highlighting */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const item of TOC) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Documentation" 
        description="Learn how to connect your Docker hosts, monitor containers, manage logs, and configure alerts with Docker Dashboard."
      />
      {/* Nav */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <LogoLink forcePublic className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Docker Dashboard</span>
          </LogoLink>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/security" className="text-muted-foreground hover:text-foreground transition-colors">Security</Link>
            <Link to="/docs" className="text-foreground font-medium">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to={authHref}><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to={authHref}><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero — compact */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Documentation</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everything you need to set up Docker Dashboard, connect your hosts, and manage your containers.
          </p>
        </div>
      </section>

      {/* Quick-jump cards */}
      <section className="pb-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: BookOpen, label: "Start Here", target: "#start-here" },
              { icon: Server, label: "Connect Host", target: "#connect-host" },
              { icon: Activity, label: "Containers", target: "#containers" },
              { icon: HelpCircle, label: "Troubleshooting", target: "#troubleshooting" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.target}
                className="glass-card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <link.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Main content: TOC + sections */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 flex gap-10">
          {/* Sticky TOC — desktop only */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                On this page
              </h3>
              <nav className="space-y-1">
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-20">
            {/* ═══════════════════════════════════════════════
                1 — START HERE
               ═══════════════════════════════════════════════ */}
            <Section id="start-here" icon={BookOpen} title="Start Here">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What Docker Dashboard does today</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Docker Dashboard is a SaaS platform for monitoring and controlling Docker containers
                  across multiple hosts. You register your Docker hosts through the web UI, and the
                  dashboard gives you a centralized view of containers, real-time resource stats, log
                  output, and the ability to start, stop, and restart containers — all without exposing
                  your Docker socket to the internet.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Who it is for</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Developers and small teams who run Docker containers on one or more servers and want
                  a simple web dashboard to inspect, control, and read logs from those containers without
                  SSH-ing into each machine.
                </p>
              </div>

              <Callout type="info" title="What you need before starting">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>A Docker host with Docker Engine running</li>
                  <li>The Watchtower Agent running on that host (provides the HTTPS API that Docker Dashboard connects to)</li>
                  <li>The agent's URL and API key</li>
                </ul>
              </Callout>

              <div className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-semibold">Your first 5 minutes</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-4 leading-relaxed">
                  <li>
                    <strong>Create an account</strong> at{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">app.dockerdash.app/login</code>{" "}
                    — sign up with email or SSO.
                  </li>
                  <li>
                    <strong>Create an organization</strong> — the onboarding wizard prompts you for an org
                    name. This is your team's workspace.
                  </li>
                  <li>
                    <strong>Connect your first host</strong> — provide the host name, agent URL, and API
                    key. The connection is tested automatically.{" "}
                    <a href="#connect-host" className="text-primary hover:underline">Full guide →</a>
                  </li>
                  <li>
                    <strong>Explore the dashboard</strong> — see your host status, container list, and
                    resource metrics.{" "}
                    <a href="#dashboard" className="text-primary hover:underline">Dashboard guide →</a>
                  </li>
                  <li>
                    <strong>Inspect a container</strong> — click any container to view details, stats,
                    logs, env vars, and networking.{" "}
                    <a href="#containers" className="text-primary hover:underline">Containers guide →</a>
                  </li>
                </ol>
              </div>
            </Section>

            {/* ═══════════════════════════════════════════════
                1.5 — HOW THE CONNECTION WORKS
               ═══════════════════════════════════════════════ */}
            <Section id="how-connection-works" icon={Cable} title="How the Connection Works">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">The short answer</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Docker does <strong>not</strong> connect to Docker Dashboard on its own. Instead,
                  a small program called the <strong>Watchtower Agent</strong> runs on your Docker
                  host. When you use the dashboard, your requests go through our backend, which calls
                  the agent, and the agent talks to Docker on your behalf.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What is the Watchtower Agent?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Watchtower Agent is a lightweight HTTPS server that you run alongside Docker on
                  your host machine. It acts as a secure bridge between Docker Dashboard and your
                  Docker Engine. The agent:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
                  <li>Listens for authenticated HTTPS requests from the Docker Dashboard backend</li>
                  <li>Verifies the API key on every request</li>
                  <li>Forwards the request to the Docker socket on your host</li>
                  <li>Returns the Docker API response back to the dashboard</li>
                </ul>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your Docker socket is <strong>never</strong> exposed to the internet. The agent is
                  the only thing that talks to Docker directly.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">How it flows</h3>
                <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap">You (Browser)</span>
                    <span className="text-muted-foreground">→ Request authenticated with your login session</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 ml-0 sm:ml-4">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap">Docker Dashboard Backend</span>
                    <span className="text-muted-foreground">→ Verifies your identity, decrypts the stored API key</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 ml-0 sm:ml-8">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap">Watchtower Agent</span>
                    <span className="text-muted-foreground">→ Validates API key, forwards to Docker</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 ml-0 sm:ml-12">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap">Docker Engine</span>
                    <span className="text-muted-foreground">→ Executes the action (list containers, fetch logs, start/stop, etc.)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every request follows this chain. The dashboard never connects to Docker directly.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What the dashboard stores from you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you add a host, the dashboard saves the following:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-border rounded-md">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left p-2 font-medium">What is stored</th>
                        <th className="text-left p-2 font-medium">How</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Host name</td>
                        <td className="p-2">Plain text — it's just a display label you choose</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Agent URL or Tunnel URL</td>
                        <td className="p-2">Plain text — the HTTPS address of your agent</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Connection mode</td>
                        <td className="p-2">"agent" (direct) or "cloudflare_tunnel"</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Agent API Key</td>
                        <td className="p-2">Encrypted at rest (AES-256-GCM). Decrypted only server-side when calling the agent. <strong>Never returned to the browser</strong> after saving.</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Docker Socket Path</td>
                        <td className="p-2">Optional — defaults to <code className="bg-muted px-1 rounded">/var/run/docker.sock</code></td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">CF Access Service Token ID & Secret</td>
                        <td className="p-2">Optional, only for CF Tunnel mode. Encrypted at rest like the API key.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What happens during a connection test</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you click <strong>"Save & Test Connection"</strong>, two things happen:
                </p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-4 leading-relaxed">
                  <li>
                    <strong>A ping is sent to the agent</strong> — the backend sends a request to your
                    agent's <code className="text-xs bg-muted px-1 py-0.5 rounded">/_ping</code> endpoint.
                    This confirms the agent is reachable and Docker is responding.
                  </li>
                  <li>
                    <strong>Docker version is fetched</strong> — if the ping succeeds, the backend also
                    calls the agent's <code className="text-xs bg-muted px-1 py-0.5 rounded">/version</code>{" "}
                    endpoint and records your Docker version and OS info.
                  </li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  If both succeed, the host status is set to <strong className="text-emerald-500">connected</strong>.
                  If the ping fails, the status is set to <strong className="text-amber-500">error</strong>,
                  but the host is still saved — you can fix the issue and re-test later.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What happens after a host is saved</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
                  <li>The host appears in your Hosts list and on the dashboard</li>
                  <li>Every time you view containers, fetch logs, or perform actions, the backend proxies requests through the agent to Docker</li>
                  <li>A server-side health poller periodically pings each host and updates its status automatically</li>
                  <li>Host data (containers, stats, logs) refreshes automatically every 30 seconds in the dashboard</li>
                </ul>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Direct vs. Cloudflare Tunnel — in plain language</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Agent (Direct)</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The dashboard's backend connects directly to your agent over the internet via
                      HTTPS. Your agent needs to be reachable at a public URL or IP address. This is
                      the simpler option if your server has a public IP or domain.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CloudCog className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Agent via CF Tunnel</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Same Watchtower Agent, but accessed through a Cloudflare Tunnel. The agent does
                      not need to be directly reachable from the internet — the tunnel handles routing.
                      Use this if your host is behind a firewall, NAT, or you don't want to open any
                      inbound ports.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Both modes use the same agent and the same API key. The only difference is how the
                  network traffic reaches the agent.
                </p>
              </div>

              <Callout type="success" title="How to know it worked">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>Host status shows <strong className="text-emerald-400">connected</strong> in the Hosts table</li>
                  <li>A Docker version number appears in the Docker column</li>
                  <li>Going to Containers shows containers from that host</li>
                  <li>You can fetch logs and view container details without errors</li>
                </ul>
              </Callout>

              <Callout type="warning" title="If this fails">
                <p className="mb-2">The most common failure causes, based on the app's behavior:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li><strong>Wrong agent URL</strong> — must include <code className="bg-muted px-1 rounded text-xs">https://</code> and the correct port</li>
                  <li><strong>API key mismatch</strong> — the key you entered must exactly match what the agent is configured with</li>
                  <li><strong>Agent not running</strong> — the agent process must be active on the Docker host</li>
                  <li><strong>Firewall blocking</strong> — the agent's port must be reachable from the internet (Direct mode) or the CF Tunnel must be active (Tunnel mode)</li>
                  <li><strong>CF Access misconfigured</strong> — if using CF Access, the service token ID and secret must be correct</li>
                  <li><strong>Docker not running</strong> — the Docker Engine must be running on the host for the agent to respond</li>
                </ul>
                <p className="mt-2">The host is still saved even if the test fails. You can fix the issue and re-test from the Hosts page.</p>
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                2 — CONNECT YOUR FIRST HOST
               ═══════════════════════════════════════════════ */}
            <Section id="connect-host" icon={Server} title="Connect Your First Host">
              <Callout type="info" title="What you need">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>The Watchtower Agent running on your Docker host</li>
                  <li>The agent's HTTPS URL (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">https://your-host:9876</code>)</li>
                  <li>The agent API key (shared secret configured on the agent)</li>
                  <li>For Cloudflare Tunnel mode: the tunnel's public hostname and optional CF Access service tokens</li>
                </ul>
              </Callout>

              <div className="glass-card p-5 space-y-1">
                <h3 className="text-sm font-semibold mb-4">Step-by-step</h3>

                <Step n={1} title="Open the host connection form">
                  <p>
                    During onboarding, the wizard takes you directly to the "Connect Host" step after
                    creating your organization. After onboarding, go to{" "}
                    <strong>Hosts</strong> in the sidebar and click <strong>Connect Host</strong>.
                  </p>
                </Step>

                <Step n={2} title="Choose your connection mode">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Terminal className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Agent (Direct)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Connects directly to the Watchtower Agent over HTTPS. Use this when your agent
                        is reachable from the internet or your network.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CloudCog className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Agent via CF Tunnel</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Same agent, accessed through a Cloudflare Tunnel. Zero open ports on your
                        host. Use this for hosts behind NAT or firewalls.
                      </p>
                    </div>
                  </div>
                </Step>

                <Step n={3} title="Fill in the required fields">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-border rounded-md">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left p-2 font-medium">Field</th>
                          <th className="text-left p-2 font-medium">Required</th>
                          <th className="text-left p-2 font-medium">What it is</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">Host Name</td>
                          <td className="p-2">Yes</td>
                          <td className="p-2">A display name for this host (e.g. "prod-server-01")</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">Agent URL / Tunnel URL</td>
                          <td className="p-2">Yes</td>
                          <td className="p-2">The HTTPS URL where the agent or tunnel is reachable</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">Agent API Key</td>
                          <td className="p-2">Yes</td>
                          <td className="p-2">Shared secret for authenticating with the agent. Stored encrypted (AES-256-GCM) and never returned to the browser after saving.</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">Docker Socket Path</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Defaults to <code className="bg-muted px-1 rounded">/var/run/docker.sock</code></td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">CF Access Service Token ID</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Only needed if Cloudflare Access protects the tunnel</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td className="p-2 font-medium text-foreground">CF Access Service Token Secret</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Paired with the token ID above</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Step>

                <Step n={4} title='Click "Save & Test Connection"'>
                  <p>When you click the button, two things happen in sequence:</p>
                  <ol className="list-decimal ml-4 space-y-1 mt-1">
                    <li>The host is saved to the database with your encrypted credentials.</li>
                    <li>A <strong>ping</strong> is sent to the agent. If the agent responds, the host status is set to <strong>connected</strong> and the Docker version is recorded.</li>
                  </ol>
                </Step>

                <Step n={5} title="Verify setup succeeded">
                  <p>You'll know it worked when:</p>
                  <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li>The host appears in the Hosts table with status <strong className="text-emerald-500">connected</strong></li>
                    <li>The Docker version column shows a version number</li>
                    <li>Containers from that host appear on the Containers page</li>
                  </ul>
                </Step>
              </div>

              <Callout type="warning" title="If the connection test fails">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>Check that the agent URL is correct and reachable from the internet</li>
                  <li>Verify the API key matches what the agent is configured with</li>
                  <li>Ensure the agent process is running on the Docker host</li>
                  <li>For CF Tunnel mode: verify the tunnel is active and the service token is correct</li>
                  <li>The host is still saved even if the test fails — you can re-test from the Hosts page</li>
                </ul>
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                3 — USE THE DASHBOARD
               ═══════════════════════════════════════════════ */}
            <Section id="dashboard" icon={LayoutDashboard} title="Use the Dashboard">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">What you see after onboarding</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The dashboard is the landing page at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/app</code>. It shows an overview of your organization's Docker infrastructure at a glance.
                </p>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Metric cards</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-border rounded-md">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left p-2 font-medium">Card</th>
                        <th className="text-left p-2 font-medium">What it shows</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Total Hosts</td>
                        <td className="p-2">Number of Docker hosts registered in this organization</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Connected</td>
                        <td className="p-2">Hosts where the last health check succeeded (status = "connected")</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Containers</td>
                        <td className="p-2">Total containers across all connected hosts (all states)</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium text-foreground">Running</td>
                        <td className="p-2">Containers currently in the "running" state</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Below the cards</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
                  <li><strong>Recent Containers</strong> — shows up to 8 containers with name, image, state badge, and host name. Click any to view details.</li>
                  <li><strong>Host Status</strong> — lists all registered hosts with their name, URL, and connection status. Click to view host details.</li>
                </ul>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Host status values</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">connected</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">unhealthy</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">error</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">unknown</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A server-side health poller periodically pings each host and updates these statuses. "unknown" means the host has never been successfully reached.
                </p>
              </div>

              <Callout type="info" title="Auto-refresh">
                Host and container data refreshes automatically every 30 seconds. No manual reload needed.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                4 — CONTAINERS
               ═══════════════════════════════════════════════ */}
            <Section id="containers" icon={Activity} title="Containers">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Where to find your containers</h3>
                <p className="text-sm text-muted-foreground">
                  Go to <strong>Containers</strong> in the sidebar. This page aggregates containers from
                  all connected hosts in your organization.
                </p>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">What the list shows</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li><strong>Container name</strong> — click to open the detail view</li>
                  <li><strong>State</strong> — running, exited, paused, restarting, or created</li>
                  <li><strong>Host</strong> — which registered host the container is on</li>
                  <li><strong>Image</strong> — the Docker image name</li>
                  <li><strong>Status</strong> — Docker's human-readable status (e.g. "Up 3 hours")</li>
                </ul>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Search & filter</h4>
                <p className="text-sm text-muted-foreground">
                  Use the search bar to filter by container name or image. Use the status tabs
                  (All / Running / Exited / Paused / Restarting / Created) to narrow the list.
                </p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Container detail view</h3>
                <p className="text-sm text-muted-foreground">
                  Click any container to open its detail page. You'll see four tabs:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="text-xs font-semibold mb-1">Overview</h4>
                    <p className="text-xs text-muted-foreground">
                      CPU usage %, memory usage (bytes and %), restart count, and a details
                      panel with name, ID, image, status, start/finish times, restart policy,
                      PID, and exit code. Stats refresh every 10 seconds.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="text-xs font-semibold mb-1">Logs</h4>
                    <p className="text-xs text-muted-foreground">
                      Last 200 lines of container output. Displayed in a monospace viewer.
                      Click "Refresh" to fetch new lines.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="text-xs font-semibold mb-1">Environment</h4>
                    <p className="text-xs text-muted-foreground">
                      Lists all environment variables set on the container (key=value pairs
                      from the container's configuration).
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="text-xs font-semibold mb-1">Networking</h4>
                    <p className="text-xs text-muted-foreground">
                      Shows Docker networks the container is attached to, its IP address on
                      each network, and any port bindings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Supported actions</h3>
                <p className="text-sm text-muted-foreground">
                  From the container detail page header, you can:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li><strong>Start</strong> — available when the container is stopped</li>
                  <li><strong>Stop</strong> — available when the container is running</li>
                  <li><strong>Restart</strong> — available any time</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  These actions are proxied through the backend to the Docker Engine API on the host.
                </p>
              </div>

              <Callout type="info" title="Refresh behavior">
                The container list refreshes every 30 seconds. Container stats (CPU/memory) on the
                detail page refresh every 10 seconds. Logs are fetched on-demand and not streamed.
              </Callout>

              <Callout type="warning" title="What is not supported">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>Exec / shell into containers</li>
                  <li>Creating or removing containers</li>
                  <li>Image management (pull, build, remove)</li>
                  <li>Volume or network management</li>
                </ul>
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                5 — LOGS
               ═══════════════════════════════════════════════ */}
            <Section id="logs" icon={FileText} title="Logs">
              <div className="glass-card p-5 space-y-1">
                <h3 className="text-sm font-semibold mb-4">How to fetch logs</h3>

                <Step n={1} title="Select a host">
                  <p>
                    Open <strong>Logs</strong> from the sidebar. Choose a host from the dropdown.
                    Only hosts with status <strong className="text-emerald-500">connected</strong> appear
                    in the list.
                  </p>
                </Step>

                <Step n={2} title="Select a container">
                  <p>
                    After selecting a host, the container dropdown populates with all containers on
                    that host (including stopped ones). Select the container you want logs from.
                  </p>
                </Step>

                <Step n={3} title='Click "Fetch Logs"'>
                  <p>
                    The last <strong>300 lines</strong> of the container's stdout/stderr are fetched
                    from the Docker Engine API and displayed in a monospace log viewer.
                  </p>
                </Step>
              </div>

              <div className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-semibold">Filtering</h3>
                <p className="text-sm text-muted-foreground">
                  After logs are loaded, a text filter input appears. Type any text to filter the
                  displayed lines. Filtering is <strong>case-insensitive</strong> and happens client-side
                  against the currently loaded log lines.
                </p>
              </div>

              <Callout type="warning" title="Limitations">
                <ul className="list-disc ml-4 space-y-1 mt-1">
                  <li>Logs are fetched <strong>on-demand</strong>, not streamed in real time</li>
                  <li>Each fetch returns the last 300 lines only</li>
                  <li>No log persistence, export, or download</li>
                  <li>No cross-container log aggregation</li>
                  <li>You can also view logs (last 200 lines) in the container detail page's Logs tab</li>
                </ul>
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                6 — ORGANIZATIONS & ACCESS
               ═══════════════════════════════════════════════ */}
            <Section id="organizations" icon={Users} title="Organizations & Access">
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">How organizations work</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Each organization is a separate workspace with its own Docker hosts and members.
                  All data (hosts, containers, settings) is isolated per organization — backend API queries
                  always scope to the active organization.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
                  <li>You create your first organization during onboarding</li>
                  <li>You can create additional organizations from the <strong>Organizations</strong> page</li>
                  <li>Switch between organizations using the organization switcher in the top bar</li>
                </ul>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Members</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The <strong>Members</strong> page shows a read-only list of organization members with
                  their name, role (owner or member), and join date. Organization membership is managed
                  through Clerk.
                </p>
              </div>

              <Callout type="info" title="What you see on the Organizations page">
                Each organization card shows the org name, slug, number of connected hosts, and a list
                of hosts with their status. Click a host to go to its detail page.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════
                7 — TROUBLESHOOTING
               ═══════════════════════════════════════════════ */}
            <Section id="troubleshooting" icon={HelpCircle} title="Troubleshooting">
              <p className="text-sm text-muted-foreground mb-4">
                Click any issue below to see the likely cause and what to do.
              </p>
              <div className="space-y-3">
                <TroubleshootRow
                  problem='Host shows "error" or "unhealthy" status'
                  cause="The server-side health poller cannot reach the agent. This is updated after consecutive failed pings. The host's last_error and consecutive_failures fields track this."
                  fix='Go to Hosts → click the host → click "Test Connection". Check that the agent URL is correct, the agent process is running, your firewall allows outbound HTTPS, and the API key matches. For CF Tunnel hosts, verify the tunnel is active.'
                />
                <TroubleshootRow
                  problem="No containers appear on the Containers page"
                  cause="Either no hosts are connected, or connected hosts have no Docker containers running."
                  fix='Check the dashboard — if "Connected" is 0, your hosts are unreachable. Fix host connectivity first. If hosts are connected but you still see no containers, verify that Docker containers exist on those hosts (docker ps -a).'
                />
                <TroubleshootRow
                  problem="Logs are not appearing"
                  cause="Logs are fetched on-demand, not streamed. The host must be connected and the container must exist."
                  fix='Select a host with status "connected", select a container, and click "Fetch Logs". If the host is not connected, fix the connection first. If you see an error, the agent may not be able to reach the Docker socket.'
                />
                <TroubleshootRow
                  problem="Connection test fails when adding a host"
                  cause="The agent URL is unreachable, the API key is wrong, or the agent is not running."
                  fix='Verify the agent URL format (must include https:// and port). Ensure the API key matches the agent configuration. Check that the agent is running on the host. The host is saved even if the test fails — you can re-test later from the Hosts page.'
                />
                <TroubleshootRow
                  problem="Dashboard shows empty state after login"
                  cause="You have an organization but no Docker hosts connected to it yet."
                  fix='This is normal for new accounts. Click "Connect Your First Host" on the empty dashboard or go to Hosts to add one.'
                />
                <TroubleshootRow
                  problem='"No active organization found" error'
                  cause="The Clerk session may not have synced the organization membership yet."
                  fix='Refresh the page. If the problem persists, go to Organizations and verify you are a member of at least one organization.'
                />
              </div>
            </Section>

            {/* ═══════════════════════════════════════════════
                8 — CURRENT LIMITATIONS
               ═══════════════════════════════════════════════ */}
            <Section id="limitations" icon={Construction} title="Current Limitations">
              <p className="text-sm text-muted-foreground mb-4">
                The following features are in the product roadmap but show a "Coming Soon" placeholder
                in the app today. They are not functional.
              </p>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Feature</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Monitoring dashboards (CPU, memory, network, disk charts)", "Placeholder — page exists with \"Coming Soon\" message"],
                      ["Alert rules (container failures, resource thresholds, restart loops)", "Placeholder"],
                      ["Incident management (timelines, impacted services)", "Placeholder"],
                      ["Deployment tracking (image change detection, rollback, CI/CD)", "Placeholder"],
                      ["Billing & subscriptions", "Placeholder"],
                      ["Settings — General, API Keys, Webhooks, Notifications, Audit Logs, Danger Zone tabs", "Placeholder — only the Profile tab is functional"],
                      ["Log streaming (real-time)", "Not available — logs are fetched on-demand"],
                      ["Log export / download", "Not available"],
                      ["Container exec / shell access", "Not supported"],
                      ["Image, volume, and network management", "Not supported"],
                      ["Docs search", "Disabled"],
                    ].map(([feature, status]) => (
                      <tr key={feature} className="border-b border-border last:border-0">
                        <td className="p-3 text-sm">{feature}</td>
                        <td className="p-3 text-xs text-muted-foreground">{status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-border">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">Create your account and connect your first Docker host in under 5 minutes.</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/contact"><Button size="lg" variant="outline">Contact Support</Button></Link>
            <Link to="/login"><Button size="lg" className="gap-2">Get Started <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
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
