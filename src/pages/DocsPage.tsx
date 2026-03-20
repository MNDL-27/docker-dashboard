import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Box,
  BookOpen,
  Download,
  Server,
  Bell,
  Activity,
  Rocket,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Terminal,
  Search,
} from "lucide-react";

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    desc: "Learn the basics of Docker Dashboard, from creating your account to monitoring your first container.",
    articles: [
      { title: "What is Docker Dashboard?", summary: "An overview of the platform, architecture, and how it fits into your infrastructure." },
      { title: "Creating Your Account", summary: "Sign up, create an organization, and invite your first team member." },
      { title: "Dashboard Overview", summary: "Navigate the dashboard, understand metrics, and customize your view." },
      { title: "Concepts & Terminology", summary: "Hosts, agents, organizations, and how they relate." },
    ],
  },
  {
    id: "installation",
    icon: Download,
    title: "Installation",
    desc: "Install the Docker Dashboard agent on any Docker host in under 2 minutes.",
    articles: [
      { title: "Quick Start (Docker Compose)", summary: "The fastest way to install — one YAML file and a single command." },
      { title: "Standalone Docker Run", summary: "Install with a single docker run command for quick testing." },
      { title: "Kubernetes DaemonSet", summary: "Deploy the agent across your Kubernetes cluster." },
      { title: "System Requirements", summary: "Supported Docker versions, OS compatibility, and resource usage." },
      { title: "Agent Configuration", summary: "Environment variables, custom socket paths, and advanced settings." },
    ],
  },
  {
    id: "connecting-a-host",
    icon: Server,
    title: "Connecting a Host",
    desc: "Register Docker hosts and establish secure connections through the dashboard.",
    articles: [
      { title: "Adding Your First Host", summary: "Step-by-step guide to registering a host and verifying the connection." },
      { title: "Connection Modes", summary: "Direct agent connections vs. Cloudflare Tunnel for private networks." },
      { title: "Authentication & API Keys", summary: "How agent authentication works and how to rotate keys." },
      { title: "Troubleshooting Connections", summary: "Common connection issues, firewall rules, and diagnostic commands." },
    ],
  },
  {
    id: "alerts",
    icon: Bell,
    title: "Alerts",
    desc: "Configure alerting rules and notification channels to stay ahead of issues.",
    articles: [
      { title: "Alert Rules Overview", summary: "Types of alerts: container exit, resource thresholds, restart loops, and host offline." },
      { title: "Creating Alert Rules", summary: "Build custom alert conditions with configurable thresholds." },
      { title: "Notification Channels", summary: "Route alerts to Slack, email, PagerDuty, or custom webhooks." },
      { title: "Alert History & Silencing", summary: "Review past alerts, acknowledge incidents, and set maintenance windows." },
    ],
  },
  {
    id: "monitoring",
    icon: Activity,
    title: "Monitoring",
    desc: "Track real-time metrics, logs, and container health across your entire fleet.",
    articles: [
      { title: "Host Metrics", summary: "CPU, memory, disk, and network metrics at the host level." },
      { title: "Container Metrics", summary: "Per-container resource usage, uptime, and restart history." },
      { title: "Log Explorer", summary: "Search, filter, and tail logs from all containers in one place." },
      { title: "Custom Dashboards", summary: "Create personalized views with the metrics that matter to you." },
    ],
  },
  {
    id: "deployments",
    icon: Rocket,
    title: "Deployments",
    desc: "Track container deployments, rollbacks, and version history.",
    articles: [
      { title: "Deployment Tracking", summary: "Automatically detect and log container image changes." },
      { title: "Rollback Support", summary: "One-click rollback to a previous container version." },
      { title: "Deployment Notifications", summary: "Get notified when containers are updated in your fleet." },
      { title: "CI/CD Integration", summary: "Connect your deployment pipeline for automated tracking." },
    ],
  },
  {
    id: "faq",
    icon: Box,
    title: "FAQ",
    desc: "Answers to common questions about Docker Dashboard.",
    faqs: [
      {
        q: "How does the agent connect to Docker Dashboard?",
        a: "The agent is a lightweight Docker container that runs on your host. It establishes an outbound HTTPS connection to the Docker Dashboard API — no inbound ports needed. All communication is encrypted with TLS.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. Your container data stays on your infrastructure. The agent only sends metrics, logs, and events that you configure. All secrets are encrypted at rest with AES-256-GCM, and API keys are never exposed in the UI.",
      },
      {
        q: "What Docker versions are supported?",
        a: "Docker Engine 20.10+ and Docker Desktop 4.x+. The agent supports Linux (amd64, arm64), macOS, and Windows hosts.",
      },
      {
        q: "Can I self-host Docker Dashboard?",
        a: "We offer an Enterprise plan with self-hosted deployment options. Contact our team for details on private cloud and on-premise installations.",
      },
      {
        q: "How many hosts can I monitor?",
        a: "The Free tier includes 2 hosts. Pro supports 10, Team supports 50, and Enterprise offers unlimited hosts. All plans include unlimited containers per host.",
      },
      {
        q: "What happens if the agent goes offline?",
        a: "Docker Dashboard detects agent disconnections and marks the host as offline. You'll receive an alert (if configured). Your containers continue running normally — the agent is monitoring-only and never interferes with your workloads.",
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
            Everything you need to install, configure, and operate Docker Dashboard.
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
              { icon: Download, label: "Install Agent", target: "#installation" },
              { icon: Server, label: "Connect Host", target: "#connecting-a-host" },
              { icon: Bell, label: "Set Up Alerts", target: "#alerts" },
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
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                </div>
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
          <h2 className="text-2xl font-bold tracking-tight mb-3">Can't find what you're looking for?</h2>
          <p className="text-muted-foreground mb-6">Our team is here to help. Reach out and we'll get back to you within a few hours.</p>
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
