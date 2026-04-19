import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
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
        <section className="py-20 md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">Pricing model</p>
              <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Plans matched to how you operate Docker today</h1>
              <p className="text-lg text-muted-foreground">
                The current codebase only hard-gates premium alerting today. The host, seat, and response targets below now make the plan purpose, restrictions, and SLO expectations explicit.
              </p>
            </div>

            <div className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.7)] md:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Plan graph</h2>
                  <p className="text-sm text-muted-foreground">Move right as your fleet, team coordination, and support expectations increase.</p>
                </div>
                <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary md:inline-flex">
                  Free to Enterprise
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                {pricingPlans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-[1.5rem] border p-5 backdrop-blur",
                      plan.id === "team"
                        ? "border-primary/40 bg-primary/10 shadow-[0_18px_50px_-30px_hsl(var(--primary))]"
                        : "border-border/70 bg-background/80",
                    )}
                  >
                    {index < pricingPlans.length - 1 ? (
                      <div className="absolute -right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background lg:flex">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : null}

                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{plan.audience}</p>
                        <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>
                      </div>
                      {plan.id === "team" ? (
                        <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">
                          Default paid
                        </span>
                      ) : null}
                    </div>

                    <div className="mb-4 text-3xl font-bold">{plan.priceLabel}</div>
                    <p className="mb-5 text-sm leading-6 text-muted-foreground">{plan.summary}</p>

                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">What it is for</div>
                        <div>{plan.audience}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Support / SLO</div>
                        <div>{plan.supportLabel}</div>
                        <div className="text-muted-foreground">{plan.sloLabel}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Key restrictions</div>
                        <ul className="space-y-2">
                          {plan.restrictions.map((restriction) => (
                            <li key={restriction} className="flex gap-2 text-muted-foreground">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                              <span>{restriction}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Link to={plan.id === "enterprise" ? "/contact" : `/login?plan=${plan.id}`}>
                        <Button className="w-full" variant={plan.id === "team" ? "default" : "outline"} size="sm">
                          {plan.ctaLabel}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pricingPlans.map((plan) => (
                <div key={plan.id} className="glass-card space-y-4 p-6">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{plan.name}</div>
                    <div className="mt-2 text-2xl font-bold">{plan.priceLabel}</div>
                  </div>
                  <ul className="space-y-2">
                    {plan.highlights.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90">
              <div className="border-b border-border/70 px-6 py-5">
                <h2 className="text-2xl font-semibold">Restrictions and SLO matrix</h2>
                <p className="mt-1 text-sm text-muted-foreground">A compact view of who each plan is for, what it unlocks, and how support expectations change.</p>
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
