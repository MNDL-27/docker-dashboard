import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { pricingComparisonRows, pricingPlans } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      <main className="flex-1">
        <section className="py-16 md:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">Pricing</p>
              <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Choose the operating tier that fits your team</h1>
              <p className="text-base leading-7 text-muted-foreground md:text-lg">
                Start small, upgrade when you need more hosts, more operators, and a tighter support path. The page below keeps the pricing story simple: one card per plan, then one comparison table.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-4">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "glass-card flex h-full flex-col rounded-[1.6rem] border p-6",
                    plan.id === "team" && "border-primary/50 bg-primary/10 shadow-[0_24px_60px_-40px_hsl(var(--primary))]",
                  )}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{plan.name}</p>
                      <div className="mt-3 text-4xl font-bold tracking-tight">{plan.priceLabel}</div>
                    </div>
                    {plan.id === "team" ? (
                      <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
                        Most balanced
                      </span>
                    ) : null}
                  </div>

                  <p className="mb-4 text-sm leading-6 text-muted-foreground">{plan.audience}</p>
                  <p className="mb-6 text-sm leading-6 text-foreground/85">{plan.summary}</p>

                  <div className="mb-6 rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Support</div>
                    <div className="mt-2 font-medium">{plan.supportLabel}</div>
                    <div className="text-sm text-muted-foreground">{plan.sloLabel}</div>
                  </div>

                  <ul className="mb-6 space-y-3">
                    {plan.highlights.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mb-6 rounded-2xl border border-dashed border-border/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Restrictions</div>
                    <ul className="mt-3 space-y-2">
                      {plan.restrictions.map((restriction) => (
                        <li key={restriction} className="text-sm leading-6 text-muted-foreground">
                          {restriction}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    <Link to={plan.id === "enterprise" ? "/contact" : `/login?plan=${plan.id}`}>
                      <Button className="w-full" variant={plan.id === "team" ? "default" : "outline"} size="sm">
                        {plan.ctaLabel}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90">
              <div className="border-b border-border/70 px-6 py-5">
                <h2 className="text-2xl font-semibold">Compare plans</h2>
                <p className="mt-1 text-sm text-muted-foreground">One compact matrix for the details that matter when you are choosing a tier.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30">
                      <th className="px-6 py-4 text-left font-medium text-muted-foreground">Category</th>
                      {pricingPlans.map((plan) => (
                        <th key={plan.id} className="px-6 py-4 text-left font-medium">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pricingComparisonRows.map((row) => (
                      <tr key={row.label} className="border-b border-border/60 last:border-b-0">
                        <td className="px-6 py-4 font-medium">{row.label}</td>
                        {pricingPlans.map((plan) => (
                          <td key={plan.id} className="px-6 py-4 text-muted-foreground">
                            {row.values[plan.id]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
