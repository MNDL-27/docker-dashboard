import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Check } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const plans = [
  { id: "free", name: "Free", price: 0, features: ["2 hosts", "1 user", "24h data retention", "Basic alerts", "Community support"] },
  { id: "pro", name: "Pro", price: 29, features: ["10 hosts", "5 users", "7-day retention", "Advanced alerts", "Email support", "API access"] },
  { id: "team", name: "Team", price: 79, features: ["50 hosts", "25 users", "30-day retention", "Custom dashboards", "Priority support", "SSO", "Audit logs"] },
  { id: "enterprise", name: "Enterprise", price: -1, features: ["Unlimited hosts", "Unlimited users", "Custom retention", "Dedicated support", "SLA", "On-premise option", "Custom integrations"] },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      <main className="flex-1">
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold tracking-tight mb-3">Simple, transparent pricing</h1>
              <p className="text-lg text-muted-foreground">Start free. Scale as your infrastructure grows.</p>
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
                  <Link to={p.id === "enterprise" ? "/contact" : `/login?plan=${p.id}`}>
                    <Button className="w-full" variant={p.id === "team" ? "default" : "outline"} size="sm">
                      {p.id === "enterprise" ? "Contact Sales" : "Get Started"}
                    </Button>
                  </Link>
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
