import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Box, Server, Bell, FileText, Activity, Shield, Users, ArrowRight, Check, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-16 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-8 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Now in Public Beta
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                Observe Docker<br/>fleet like a Pro
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Centralized monitoring, logs, and alerts for your distributed Docker engine fleet. 
                Lightweight agents. Real-time control. One dashboard.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link to="/sign-up">
                  <Button size="lg" className="h-14 px-8 text-lg font-semibold gap-2">
                    Get Started for Free <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/docs">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                    Read the Docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 border-y border-border bg-card/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold">Built for Reliability</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Everything you need to keep your containers running smoothly across any number of hosts.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Server, title: "Multi-Host Monitoring", desc: "Monitor all your Docker hosts from a single pane of glass. Real-time metrics and health checks." },
                { icon: Bell, title: "Smart Alerts", desc: "Set up alert rules for container failures, resource thresholds, and host connectivity issues." },
                { icon: FileText, title: "Centralized Logs", desc: "Stream and search logs from every container across all your hosts. Filter by host and time." },
                { icon: Activity, title: "Incident Management", desc: "Track, investigate, and resolve incidents with a full timeline and impacted services." },
                { icon: Users, title: "Team Collaboration", desc: "Invite your team with role-based access. Owner, admin, developer, and viewer roles." },
                { icon: Shield, title: "Self-Hosted Agent", desc: "Your data stays on your infrastructure. Our lightweight agent connects securely to the control plane." }
              ].map((f, i) => (
                <div key={i} className="glass-card p-8 space-y-4 group hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Peek */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-4 text-center space-y-8">
            <h2 className="text-4xl font-bold">Scale as you grow</h2>
            <div className="flex justify-center flex-wrap gap-4">
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="h-12 border-primary/20 hover:border-primary/50">
                  View full pricing & plans
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
