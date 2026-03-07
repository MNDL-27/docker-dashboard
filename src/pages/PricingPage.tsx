import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, Check } from "lucide-react";
import { plans } from "@/lib/mock-data";

export default function PricingPage() {
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
            <Link to="/signup"><Button size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

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
                <Link to="/signup"><Button className="w-full" variant={p.id === "team" ? "default" : "outline"} size="sm">
                  {p.price === -1 ? "Contact Sales" : "Get Started"}
                </Button></Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
