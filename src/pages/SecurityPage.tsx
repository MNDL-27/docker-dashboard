import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Shield, Lock, Eye, Server, Globe } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const items = [
  { icon: Lock, title: "End-to-End Encryption", desc: "All data in transit is encrypted with TLS 1.3. Data at rest uses AES-256 encryption." },
  { icon: Shield, title: "SOC 2 Type II", desc: "We maintain SOC 2 Type II compliance with annual audits by independent third parties." },
  { icon: Eye, title: "No Inbound Access Required", desc: "Our agent initiates all connections outbound. No open ports needed on your infrastructure." },
  { icon: Server, title: "Your Data, Your Infrastructure", desc: "Container data stays on your hosts. Only metrics and logs you choose to send reach our cloud." },
  { icon: Globe, title: "GDPR Compliant", desc: "Full GDPR compliance with data processing agreements, EU hosting options, and data deletion on request." },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      <main className="flex-1">
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
      </main>

      <PublicFooter />
    </div>
  );
}
