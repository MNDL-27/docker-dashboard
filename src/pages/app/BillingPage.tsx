import { PageHeader } from "@/components/shared/PageHeader";
import { Construction, Check, ArrowRight, X } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const planDetails = {
  pro: { name: "Pro", price: "$29/mo", features: ["10 hosts", "5 users", "7-day retention"] },
  team: { name: "Team", price: "$79/mo", features: ["50 hosts", "25 users", "30-day retention"] },
};

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    const plan = searchParams.get("plan") || sessionStorage.getItem("dockerdash_pending_plan");
    if (plan === "pro" || plan === "team") {
      setSelectedPlan(plan);
    }
  }, [searchParams]);

  const handleClearPlan = () => {
    sessionStorage.removeItem("dockerdash_pending_plan");
    setSelectedPlan(null);
    navigate("/app/billing", { replace: true });
  };

  const handleCheckout = () => {
    // This would trigger Paddle / Stripe checkout
    alert(`Redirecting to ${selectedPlan?.toUpperCase()} checkout...`);
    sessionStorage.removeItem("dockerdash_pending_plan");
    navigate("/app");
  };

  if (selectedPlan && (selectedPlan === "pro" || selectedPlan === "team")) {
    const details = planDetails[selectedPlan as keyof typeof planDetails];
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Complete your Subscription"
          description={`Almost there! Set up your ${details.name} plan to activate all features.`}
          breadcrumbs={[{ label: "Management" }, { label: "Billing" }, { label: "Checkout" }]}
        />
        
        <div className="max-w-md mx-auto">
          <div className="glass-card overflow-hidden ring-2 ring-primary">
            <div className="p-6 border-b border-border bg-primary/5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{details.name} Plan</h3>
                <p className="text-2xl font-bold">{details.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearPlan}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <ul className="space-y-2">
                {details.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full gap-2" onClick={handleCheckout}>
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Button>
              <button 
                onClick={handleClearPlan}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                No thanks, stay on Free tier for now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Subscription management, usage tracking, and invoices are under development.
        </p>
      </div>
    </div>
  );
}
