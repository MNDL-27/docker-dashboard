import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Box,
  BookOpen,
  Server,
  Activity,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Terminal,
  Search,
  Users,
  FileText,
  Shield,
  HelpCircle,
  Construction,
} from "lucide-react";

/*
 * ────────────────────────────────────────────────────────────
 *  Evidence-based documentation.
 *
 *  Every section below is derived from source code analysis.
 *  Where functionality is incomplete or unavailable, this is
 *  stated explicitly rather than hidden behind polished copy.
 * ────────────────────────────────────────────────────────────
 */

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    desc: "Create your account, set up your organization, and connect your first Docker host.",
    articles: [
      {
        title: "Sign Up & Sign In",
        summary:
          "Create an account at app.dockerdash.app/login. Authentication is handled by Clerk — you can sign up with email or a supported SSO provider.",
      },
      {
        title: "Create an Organization",
        summary:
          "After signing in, the onboarding wizard prompts you to create an organization. Organizations are the top-level workspace that groups your Docker hosts and team members.",
      },
      {
        title: "Connect Your First Host",
        summary:
          "Step 2 of onboarding asks for a host name, agent URL, connection mode (Agent Direct or Cloudflare Tunnel), and an API key. The connection is tested automatically before proceeding.",
      },
      {
        title: "Dashboard Overview",
        summary:
          "After onboarding, the dashboard shows four metric cards (Total Hosts, Connected, Containers, Running), a list of recent containers with state badges, and host connection status.",
      },
    ],
  },
  {
    id: "connecting-hosts",
    icon: Server,
    title: "Connecting Hosts",
    desc: "Register Docker hosts and manage connections through the dashboard.",
    articles: [
      {
        title: "Connection Modes",
        summary:
          "Two modes are supported: Agent (Direct) connects over HTTPS to the Watchtower Agent, and Agent via Cloudflare Tunnel routes through a CF Tunnel. Both require an Agent API Key.",
      },
      {
        title: "Required Fields",
        summary:
          "Host Name, Agent or Tunnel URL, Agent API Key (stored encrypted with AES-256-GCM, never returned to the browser). Optional: Docker Socket Path (defaults to /var/run/docker.sock), CF Access Service Token fields.",
      },
      {
        title: "Host Management",
        summary:
          "The Hosts page lists all registered hosts with their connection mode, status (connected / unhealthy / error / unknown), URL, Docker version, and last-seen timestamp. You can test connections and remove hosts.",
      },
      {
        title: "Health Polling",
        summary:
          "A server-side cron job periodically pings each registered host and updates its status, Docker version, and consecutive failure count in the database.",
      },
    ],
  },
  {
    id: "containers",
    icon: Activity,
    title: "Container Management",
    desc: "View, inspect, and control containers across all connected hosts.",
    articles: [
      {
        title: "Container List",
        summary:
          "The Containers page aggregates containers from all connected hosts in your organization. Each entry shows the container name, image, state (running / exited / paused), and which host it belongs to.",
      },
      {
        title: "Container Details",
        summary:
          "Click any container to view its inspect data, live resource stats (CPU and memory usage, refreshed every 10 seconds), and log output (last 200 lines by default).",
      },
      {
        title: "Container Actions",
        summary:
          "You can start, stop, and restart containers directly from the dashboard. These actions are proxied through the backend to the Docker Engine API on the target host.",
      },
    ],
  },
  {
    id: "logs",
    icon: FileText,
    title: "Log Explorer",
    desc: "View real container logs from any connected host.",
    articles: [
      {
        title: "How It Works",
        summary:
          "Select a connected host, then a container. Click \"Fetch Logs\" to retrieve the last 300 lines from the Docker Engine API. Logs are displayed in a monospace viewer with line-by-line rendering.",
      },
      {
        title: "Filtering",
        summary:
          "A text filter lets you search within fetched logs using case-insensitive matching. Filtering is client-side against the currently loaded log lines.",
      },
      {
        title: "Limitations",
        summary:
          "Logs are fetched on-demand (not streamed in real time). There is no log persistence, export, or cross-container aggregation at this time.",
      },
    ],
  },
  {
    id: "organizations",
    icon: Users,
    title: "Organizations & Members",
    desc: "Multi-tenant workspaces powered by Clerk.",
    articles: [
      {
        title: "Organizations",
        summary:
          "Each organization is a separate workspace with its own set of Docker hosts. You can create multiple organizations and switch between them using the organization switcher in the top bar.",
      },
      {
        title: "Member Roles",
        summary:
          "Organization membership is managed through Clerk. The database tracks roles (owner, member). Member management is available in the Members page within the app.",
      },
      {
        title: "Data Isolation",
        summary:
          "All API requests are scoped to the active organization. Docker hosts, container data, and settings are isolated per organization. Backend queries always join against organization membership.",
      },
    ],
  },
  {
    id: "security",
    icon: Shield,
    title: "Security & Authentication",
    desc: "How authentication, authorization, and secret storage work.",
    articles: [
      {
        title: "Authentication",
        summary:
          "All authentication is handled by Clerk. The backend verifies Clerk JWTs on every API request using the @clerk/backend SDK. Unauthenticated requests are rejected with 401.",
      },
      {
        title: "Secret Storage",
        summary:
          "Agent API keys and Cloudflare service tokens are encrypted at rest using AES-256-GCM with the AGENT_ENCRYPTION_KEY environment variable. Secrets are decrypted server-side only when proxying requests to Docker agents. They are never returned to the browser.",
      },
      {
        title: "Domain Enforcement",
        summary:
          "Product routes (/app, /onboarding, /login) are restricted to app.dockerdash.app using frontend hostname detection. Marketing pages are served from dockerdash.app. Documentation is served from docs.dockerdash.app. Local development (localhost) shows all routes.",
      },
    ],
  },
  {
    id: "coming-soon",
    icon: Construction,
    title: "Planned Features",
    desc: "Features that are in the product roadmap but not yet implemented.",
    planned: [
      {
        title: "Monitoring Dashboards",
        summary: "Aggregated CPU, memory, network, and disk metrics with time-series charts. The UI page exists but shows a \"Coming Soon\" placeholder.",
      },
      {
        title: "Alert Rules",
        summary: "Configurable alerts for container failures, resource thresholds, restart loops, and host connectivity. Not yet implemented.",
      },
      {
        title: "Incident Management",
        summary: "Incident tracking with timelines and impacted services. Not yet implemented.",
      },
      {
        title: "Deployment Tracking",
        summary: "Container image change detection, rollback, and CI/CD integration. Not yet implemented.",
      },
      {
        title: "Billing & Subscriptions",
        summary: "Subscription management and usage tracking. Not yet implemented.",
      },
    ],
  },
  {
    id: "faq",
    icon: HelpCircle,
    title: "FAQ",
    desc: "Answers to common questions.",
    faqs: [
      {
        q: "What is Docker Dashboard?",
        a: "Docker Dashboard (also called Watchtower) is a SaaS platform for monitoring and managing Docker containers across multiple hosts. You install a lightweight agent on your Docker hosts, and the dashboard provides a centralized UI for viewing containers, reading logs, and controlling container lifecycle.",
      },
      {
        q: "How does the agent connection work?",
        a: "The Watchtower Agent runs on your Docker host and exposes an HTTPS API. Docker Dashboard's backend proxies requests to the agent whenever you view containers, fetch logs, or start/stop containers. No inbound ports on your host are required if you use a Cloudflare Tunnel.",
      },
      {
        q: "Is my data secure?",
        a: "Agent API keys and Cloudflare tokens are encrypted at rest with AES-256-GCM. All API requests require a valid Clerk JWT. Secrets are never returned to the browser after being saved. The backend decrypts them only when proxying requests to your agents.",
      },
      {
        q: "What Docker versions are supported?",
        a: "The agent connects to the standard Docker Engine API. Any Docker Engine version that exposes the /v1.x API should work. Specific version requirements depend on your agent implementation.",
      },
      {
        q: "Can I monitor multiple hosts?",
        a: "Yes. You can register multiple Docker hosts per organization. The dashboard aggregates containers from all connected hosts and displays them in a unified view.",
      },
      {
        q: "What happens if a host goes offline?",
        a: "The server-side health poller detects disconnections and marks the host status as unhealthy or error after consecutive failures. The host's last-seen timestamp and error message are displayed in the Hosts page.",
      },
    ],
  },
];

export default function DocsPage() {
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
            <Link to="/docs" className="text-foreground font-medium">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/login"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Documentation</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Learn how to set up and use Docker Dashboard to monitor your Docker infrastructure.
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documentation..."
              disabled
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card/50 text-sm text-muted-foreground cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-medium">Coming soon</span>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="pb-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Terminal, label: "Quick Start", target: "#getting-started" },
              { icon: Server, label: "Connect Host", target: "#connecting-hosts" },
              { icon: Activity, label: "Containers", target: "#containers" },
              { icon: FileText, label: "Log Explorer", target: "#logs" },
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

      {/* Sections */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4 space-y-16">
          {sections.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-20">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              </div>
              <p className="text-muted-foreground mb-6 ml-[52px]">{section.desc}</p>

              {/* FAQ Section */}
              {"faqs" in section && section.faqs ? (
                <div className="space-y-3 ml-[52px]">
                  {section.faqs.map((faq) => (
                    <details key={faq.q} className="glass-card p-4 group">
                      <summary className="flex items-center justify-between cursor-pointer font-medium text-sm list-none">
                        {faq.q}
                        <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform shrink-0 ml-4" />
                      </summary>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{faq.a}</p>
                    </details>
                  ))}
                </div>
              ) : "planned" in section && section.planned ? (
                /* Planned Features */
                <div className="space-y-3 ml-[52px]">
                  {section.planned.map((item) => (
                    <div key={item.title} className="glass-card p-4 border-dashed">
                      <div className="flex items-center gap-2 mb-1">
                        <Construction className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="font-medium text-sm">{item.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed ml-[22px]">{item.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                /* Article List */
                <div className="grid md:grid-cols-2 gap-3 ml-[52px]">
                  {"articles" in section &&
                    section.articles?.map((article) => (
                      <div
                        key={article.title}
                        className="glass-card p-5 hover:border-primary/30 transition-colors group cursor-default"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm mb-1.5 group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
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
