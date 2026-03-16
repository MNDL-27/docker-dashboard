import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Shield, Lock, Eye, Server, Globe } from "lucide-react";

const items = [
  { icon: Lock, title: "End-to-End Encryption", desc: "All data in transit is encrypted with TLS 1.3. Data at rest uses AES-256 encryption." },
  { icon: Shield, title: "SOC 2 Type II", desc: "We maintain SOC 2 Type II compliance with annual audits by independent third parties." },
  { icon: Eye, title: "No Inbound Access Required", desc: "Our agent initiates all connections outbound. No open ports needed on your infrastructure." },
  { icon: Server, title: "Your Data, Your Infrastructure", desc: "Container data stays on your hosts. Only metrics and logs you choose to send reach our cloud." },
  { icon: Globe, title: "GDPR Compliant", desc: "Full GDPR compliance with data processing agreements, EU hosting options, and data deletion on request." },
];

export default function SecurityPage() {
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
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Security First</h1>
            <p className="text-lg text-muted-foreground">Your infrastructure security is our top priority.</p>
          </div>
          <div className="space-y-6">
            {items.map(item => (
              <div key={item.title} className="glass-card p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
