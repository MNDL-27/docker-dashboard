import { Shield, Lock, Eye, Server, KeyRound } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const items = [
  { icon: Lock, title: "Encrypted Secret Storage", desc: "Stored host credentials are encrypted before they are written to the application database, with support for key rotation." },
  { icon: Shield, title: "Organization-Scoped Access", desc: "Backend API access is resolved against the active organization, with owner and admin checks on write actions." },
  { icon: Eye, title: "Docker Socket Stays Behind the Agent", desc: "The hosted control plane talks to the Watchtower Agent instead of reaching the Docker socket directly." },
  { icon: Server, title: "Shared Responsibility Model", desc: "You operate the hosts and agent endpoints; Docker Dashboard provides the management plane, access control, and connectivity workflows." },
  { icon: KeyRound, title: "Per-Host Agent Credentials", desc: "Each host can use its own agent API key and optional Cloudflare access credentials for tunnel-based deployments." },
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
              <p className="text-lg text-muted-foreground">Concrete controls we can stand behind today.</p>
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
