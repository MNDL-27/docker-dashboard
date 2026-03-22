import { PageHeader } from "@/components/shared/PageHeader";
import { Construction, Check, ArrowRight, X, Loader2, Zap, Box } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const planDetails = {
  pro: { 
    name: "Pro", 
    price: "$29/mo", 
    priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || "pri_01j7p3v1v1v1v1v1v1v1v1v1v1", // Fallback example
    features: ["10 hosts", "5 users", "7-day retention", "Advanced alerts", "API access"] 
  },
  team: { 
    name: "Team", 
    price: "$79/mo", 
    priceId: import.meta.env.VITE_PADDLE_TEAM_PRICE_ID || "pri_01j7p3v2v2v2v2v2v2v2v2v2v2", // Fallback example
    features: ["50 hosts", "25 users", "30-day retention", "Custom dashboards", "Priority support", "SSO"] 
  },
};

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { user } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch real organization details including billing state
  const { data: orgDetails, isLoading, refetch } = useQuery({
    queryKey: ['billing-org-details', organization?.id],
    queryFn: async () => {
      const orgs = await apiFetch('/organizations') as Array<{ id: string; plan: string; subscription_status?: string; current_period_ends_at?: string; cancel_at_period_end?: boolean }>;
      return orgs.find(o => o.id === organization?.id);
    },
    enabled: !!organization?.id,
  });

  useEffect(() => {
    const plan = searchParams.get("plan") || sessionStorage.getItem("dockerdash_pending_plan");
    if ((plan === "pro" || plan === "team") && (!orgDetails || orgDetails.plan === "free")) {
      setSelectedPlan(plan);
      if (plan) sessionStorage.setItem("dockerdash_pending_plan", plan);
    }
  }, [searchParams, orgDetails]);

  const handleClearPlan = () => {
    sessionStorage.removeItem("dockerdash_pending_plan");
    setSelectedPlan(null);
    navigate("/app/billing", { replace: true });
  };

  const handleCheckout = () => {
    if (!selectedPlan || !organization || !window.Paddle) return;

    const details = planDetails[selectedPlan as keyof typeof planDetails];
    const priceId = selectedPlan === 'pro' 
      ? import.meta.env.VITE_PADDLE_LAUNCH_PRICE_ID 
      : import.meta.env.VITE_PADDLE_SCALE_PRICE_ID;

    if (!priceId) {
      console.error("Missing Price ID for plan:", selectedPlan);
      return;
    }

    window.Paddle.Checkout.open({
      items: [{ priceId: priceId, quantity: 1 }],
      customer: user?.primaryEmailAddress?.emailAddress ? { email: user.primaryEmailAddress.emailAddress } : undefined,
      customData: {
        organization_id: organization.id,
        intended_plan: selectedPlan
      },
      settings: {
        displayMode: 'overlay',
        theme: 'dark'
      }
    });

    // Clear local intent once handoff starts
    sessionStorage.removeItem("dockerdash_pending_plan");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Active or Pending Subscription View
  if (orgDetails && orgDetails.plan !== 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Billing"
          description="Manage your subscription and billing"
          breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
        />
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold capitalize">{orgDetails.plan} Plan</h3>
                <p className="text-sm text-muted-foreground">Status: <span className="text-foreground font-medium capitalize">{orgDetails.subscription_status || 'Active'}</span></p>
              </div>
              <div className="ml-auto">
                <span className="px-2 py-1 rounded bg-success/20 text-success text-[10px] font-bold uppercase tracking-wider">
                  {orgDetails.subscription_status === 'active' ? 'Active' : 'Processing'}
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing Period</span>
                <span>Monthly</span>
              </div>
              {orgDetails.current_period_ends_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next Invoice</span>
                  <span>{new Date(orgDetails.current_period_ends_at).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <span>Paddle managed</span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="outline" size="sm" onClick={() => window.open('https://paddle.com/support', '_blank')}>
                Billing Support
              </Button>
              {orgDetails.cancel_at_period_end ? (
                <Button variant="secondary" size="sm" disabled>Canceled at end of period</Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-semibold mb-4">Plan Limits</h4>
            <ul className="space-y-3">
              {planDetails[orgDetails.plan as keyof typeof planDetails]?.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-success shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Checkout State View (User selected a plan but hasn't paid)
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

  // Default Free / Empty State View
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
      />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Box className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Free Plan</h3>
              <p className="text-sm text-muted-foreground">Basic monitoring for small setups</p>
            </div>
          </div>
          <ul className="space-y-2 mb-8">
            <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" /> 2 hosts</li>
            <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" /> 1 user</li>
            <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" /> 24h data retention</li>
          </ul>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm mb-4">Need more capacity? Upgrade to Pro or Team for advanced features.</p>
            <Button className="w-full" onClick={() => navigate('/pricing')}>View Paid Plans</Button>
          </div>
        </div>

        <div className="glass-card p-12 text-center flex flex-col items-center justify-center border-dashed">
          <Construction className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Invoice history and self-serve plan switching are under development.
          </p>
        </div>
      </div>
    </div>
  );
}
