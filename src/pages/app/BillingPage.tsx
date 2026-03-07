import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { plans, invoices } from "@/lib/mock-data";
import { Check, CreditCard, Download, ArrowUpRight } from "lucide-react";
import { useState } from "react";

export default function BillingPage() {
  const [showPlans, setShowPlans] = useState(false);
  const currentPlan = plans.find(p => p.id === "team")!;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
      />

      {/* Current Plan */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Plan</div>
            <div className="text-2xl font-bold">{currentPlan.name}</div>
            <div className="text-sm text-muted-foreground mt-1">${currentPlan.price}/month • Renews Feb 1, 2024</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowPlans(!showPlans)} className="gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5" />Change Plan
          </Button>
        </div>
      </div>

      {/* Usage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Hosts" value="8 / 50" />
        <MetricCard label="Users" value="5 / 25" />
        <MetricCard label="Alert Channels" value="3 / 10" />
        <MetricCard label="Data Retention" value="30 days" />
      </div>

      {/* Plan Comparison */}
      {showPlans && (
        <div className="grid md:grid-cols-4 gap-3">
          {plans.map(p => (
            <div key={p.id} className={`glass-card p-4 space-y-3 ${p.id === "team" ? "ring-2 ring-primary" : ""}`}>
              <h3 className="font-semibold">{p.name}</h3>
              <div className="text-2xl font-bold">
                {p.price === -1 ? "Custom" : `$${p.price}`}
                {p.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </div>
              <ul className="space-y-1.5">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-success shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Button size="sm" variant={p.id === "team" ? "default" : "outline"} className="w-full" disabled={p.id === "team"}>
                {p.id === "team" ? "Current" : p.price === -1 ? "Contact Sales" : "Upgrade"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Payment Method */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Visa ending in 4242</div>
              <div className="text-xs text-muted-foreground">Expires 12/2025</div>
            </div>
          </div>
          <Button size="sm" variant="outline">Update</Button>
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h3 className="text-sm font-medium mb-3">Invoices</h3>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Plan</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="p-3">{inv.date}</td>
                  <td className="p-3 text-muted-foreground">{inv.plan}</td>
                  <td className="p-3 font-medium">{inv.amount}</td>
                  <td className="p-3"><StatusBadge status={inv.status} /></td>
                  <td className="p-3 text-right"><Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3 w-3" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
