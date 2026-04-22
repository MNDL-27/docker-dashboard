import { PageHeader } from "@/components/shared/PageHeader";
import { ScanQuotaUsageCard } from "@/components/billing/ScanQuotaUsageCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Construction, Check, ArrowRight, X, Loader2, Zap, Box, HeartHandshake } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCheckoutPriceId, getPricingPlan } from "@/lib/pricing";
import { useViewerState } from "@/hooks/useViewerState";

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { user } = useUser();
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "team" | null>(null);
  const [donorIntentLoading, setDonorIntentLoading] = useState(false);
  const [donorIntent, setDonorIntent] = useState<null | {
    reference_token: string;
    instructions: string[];
    grant_days: number;
  }>(null);
  const [donorTransactionId, setDonorTransactionId] = useState("");
  const [paddleStatus, setPaddleStatus] = useState<"checking" | "ready" | "unavailable">(() =>
    typeof window !== "undefined" && window.Paddle ? "ready" : "checking",
  );
  const freePlanDetails = getPricingPlan("free");
  const activeOrganizationId = viewer?.active_org_id ?? null;
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;
  const quotaUsageCard = (
    <ScanQuotaUsageCard
      plan={effectivePlan}
      limit={viewer?.active_org_scan_limit}
      used={viewer?.active_org_scan_used}
      remaining={viewer?.active_org_scan_remaining}
      resetAt={viewer?.active_org_scan_reset_at}
    />
  );

  // Fetch real organization details including billing state
  const { data: orgDetails, isLoading } = useQuery({
    queryKey: ['billing-org-details', activeOrganizationId ?? organization?.id],
    queryFn: async () => {
      const orgs = await apiFetch('/organizations') as Array<{
        id: string;
        clerk_org_id?: string;
        plan: string;
        subscription_status?: string;
        current_period_ends_at?: string;
        cancel_at_period_end?: boolean;
        donor_premium_expires_at?: string | null;
        payment_provider?: string | null;
      }>;
      return orgs.find((o) => o.id === activeOrganizationId);
    },
    enabled: Boolean(activeOrganizationId),
  });

  useEffect(() => {
    const plan = searchParams.get("plan") || sessionStorage.getItem("dockerdash_pending_plan");
    if ((plan === "pro" || plan === "team") && (!orgDetails || orgDetails.plan === "free")) {
      setSelectedPlan(plan);
      if (plan) sessionStorage.setItem("dockerdash_pending_plan", plan);
    }
  }, [searchParams, orgDetails]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.Paddle) {
      setPaddleStatus("ready");
      return;
    }

    const paddleScript = document.querySelector<HTMLScriptElement>('script[src*="cdn.paddle.com/paddle/v2/paddle.js"]');
    const markReady = () => setPaddleStatus("ready");
    const markUnavailable = () => setPaddleStatus("unavailable");
    const timeoutId = window.setTimeout(() => {
      if (!window.Paddle) {
        markUnavailable();
      }
    }, 4000);

    paddleScript?.addEventListener("load", markReady);
    paddleScript?.addEventListener("error", markUnavailable);

    return () => {
      window.clearTimeout(timeoutId);
      paddleScript?.removeEventListener("load", markReady);
      paddleScript?.removeEventListener("error", markUnavailable);
    };
  }, []);

  const handleClearPlan = () => {
    sessionStorage.removeItem("dockerdash_pending_plan");
    setSelectedPlan(null);
    navigate("/app/billing", { replace: true });
  };

  const handleCheckout = () => {
    if (!selectedPlan || !activeOrganizationId) {
      return;
    }

    if (!window.Paddle) {
      setPaddleStatus("unavailable");
      toast({
        title: "Checkout is unavailable",
        description: "Paddle did not load in this browser. Disable blockers for Paddle and try again.",
        variant: "destructive",
      });
      return;
    }

    const priceId = getCheckoutPriceId(selectedPlan);

    if (!priceId) {
      console.error("Missing Price ID for plan:", selectedPlan);
      toast({
        title: "Checkout is unavailable",
        description: "The billing price ID is missing for this plan.",
        variant: "destructive",
      });
      return;
    }

    window.Paddle.Checkout.open({
      items: [{ priceId: priceId, quantity: 1 }],
      customer: user?.primaryEmailAddress?.emailAddress ? { email: user.primaryEmailAddress.emailAddress } : undefined,
      customData: {
        organization_id: activeOrganizationId,
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

  const donationUrl = import.meta.env.VITE_DONATION_URL || "https://liberapay.com/MNDL-27/";
  const paypalDonationUrl = import.meta.env.VITE_PAYPAL_DONATION_URL || "https://www.paypal.com/paypalme/ProtikMondal27";

  const handleCreateDonorIntent = async () => {
    if (!activeOrganizationId) return;

    setDonorIntentLoading(true);
    try {
      const response = await apiFetch('/donor-intent', {
        method: 'POST',
        body: {
          organization_id: activeOrganizationId,
          intended_plan: selectedPlan || 'pro',
          payer_email: user?.primaryEmailAddress?.emailAddress || undefined,
        },
      }) as { reference_token: string; instructions: string[]; grant_days: number };

      setDonorIntent(response);
      toast({
        title: 'Donor token created',
        description: `Reference ${response.reference_token} ready. Include it in your payment note.`,
      });
    } catch (error) {
      toast({
        title: 'Could not create donor token',
        description: error instanceof Error ? error.message : 'Please retry in a few moments.',
        variant: 'destructive',
      });
    } finally {
      setDonorIntentLoading(false);
    }
  };

  const handleSubmitTransactionHint = () => {
    if (!donorTransactionId.trim()) {
      toast({ title: 'Transaction ID required', description: 'Paste your PayPal transaction ID first.', variant: 'destructive' });
      return;
    }

    toast({
      title: 'Payment note recorded',
      description: 'Share this transaction ID with support/admin for faster donor premium activation.',
    });
    setDonorTransactionId('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Active or Pending Subscription View
  const hasPremiumAccess = effectivePlan && effectivePlan !== 'free';
  if (orgDetails && hasPremiumAccess) {
    const activePlan = getPricingPlan(effectivePlan as "pro" | "team" | "enterprise");
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Billing"
          description="Manage your subscription and billing"
          breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
        />

        {quotaUsageCard}
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{activePlan?.name ?? orgDetails.plan} Plan</h3>
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
                <span>{orgDetails.payment_provider ? `${orgDetails.payment_provider} managed` : 'Paddle managed'}</span>
              </div>
              {orgDetails.donor_premium_expires_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Donor premium access</span>
                  <span>Active until {new Date(orgDetails.donor_premium_expires_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              {orgDetails.plan === "enterprise" || viewer?.dedicated_deployment_status ? (
                <Button variant="secondary" size="sm" onClick={() => navigate('/app/dedicated-deployment')}>
                  Deployment Status
                </Button>
              ) : null}
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
              {(activePlan?.highlights ?? []).map(f => (
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
    const details = getPricingPlan(selectedPlan);
    if (!details) {
      return null;
    }
    const paddleBlocked = paddleStatus === "unavailable";
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Complete your Subscription"
          description={`Almost there. Activate the ${details.name} plan to unlock the paid operating envelope and premium alerting.`}
          breadcrumbs={[{ label: "Management" }, { label: "Billing" }, { label: "Checkout" }]}
        />

        {quotaUsageCard}
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="glass-card overflow-hidden ring-2 ring-primary">
            <div className="p-6 border-b border-border bg-primary/5 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{details.name} Plan</h3>
                <p className="text-2xl font-bold">{details.priceLabel}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearPlan}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {paddleBlocked && (
                <Alert variant="destructive" className="bg-destructive/5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Checkout blocked in this browser</AlertTitle>
                  <AlertDescription>
                    Paddle failed to load. Disable ad or privacy blockers for Paddle, then refresh and try again.
                  </AlertDescription>
                </Alert>
              )}
              <ul className="space-y-2">
                {details.highlights.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full gap-2" onClick={handleCheckout} disabled={paddleStatus === "checking"}>
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Button>
              {paddleStatus === "checking" && (
                <p className="text-xs text-muted-foreground text-center">
                  Loading secure checkout...
                </p>
              )}
              <button 
                onClick={handleClearPlan}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                No thanks, stay on Free tier for now
              </button>
            </div>
          </div>

          <div className="glass-card p-5 border-dashed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <HeartHandshake className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Donor access fallback</h4>
                <p className="text-xs text-muted-foreground">
                  If checkout is blocked in your country, donate manually and include the reference token in your payment note.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Button variant="outline" className="w-full" onClick={handleCreateDonorIntent} disabled={donorIntentLoading}>
                {donorIntentLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate donor token (DNR-8)
              </Button>

              {donorIntent ? (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference token</p>
                  <p className="font-mono text-sm">{donorIntent.reference_token}</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {donorIntent.instructions.map((instruction) => (
                      <li key={instruction}>• {instruction}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(donationUrl, '_blank')}>Open Liberapay</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(paypalDonationUrl, '_blank')}>Open PayPal</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Manual verification target: within 24 hours. Access is granted for {donorIntent.grant_days} days per matched donation.
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  value={donorTransactionId}
                  onChange={(event) => setDonorTransactionId(event.target.value)}
                  placeholder="Paste PayPal transaction ID"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button size="sm" onClick={handleSubmitTransactionHint}>I have paid</Button>
              </div>
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
      {quotaUsageCard}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Box className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{freePlanDetails?.name ?? "Free"} Plan</h3>
              <p className="text-sm text-muted-foreground">{freePlanDetails?.audience ?? "Basic monitoring for small setups"}</p>
            </div>
          </div>
          <ul className="space-y-2 mb-8">
            {(freePlanDetails?.highlights ?? []).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" /> {feature}</li>
            ))}
          </ul>
          <div className="mb-8 rounded-lg border border-dashed border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Restrictions</p>
            <ul className="space-y-1">
              {(freePlanDetails?.restrictions ?? []).map((restriction) => (
                <li key={restriction} className="text-sm text-muted-foreground">{restriction}</li>
              ))}
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm mb-4">Need advanced alerting, more seats, or a support response target? Upgrade to Individual or Business.</p>
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

        <div className="glass-card p-8 md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <HeartHandshake className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Dedicated managed instance</h3>
              <p className="text-sm text-muted-foreground">
                Need isolated infrastructure, custom allocations, and a guided deployment handoff instead of self-serve checkout?
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/dedicated/start')}>View dedicated deployment</Button>
            {viewer?.dedicated_deployment_status ? (
              <Button variant="outline" onClick={() => navigate('/app/dedicated-deployment')}>
                Open deployment status
              </Button>
            ) : null}
          </div>
        </div>

        <div className="glass-card p-8 md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <HeartHandshake className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Donor premium (manual verification)</h3>
              <p className="text-sm text-muted-foreground">
                You can unlock premium via Liberapay or PayPal donations while checkout integrations are limited in your region.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Button variant="outline" onClick={handleCreateDonorIntent} disabled={donorIntentLoading}>
              {donorIntentLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate donor token (DNR-8)
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => window.open(donationUrl, '_blank')}>Open Liberapay</Button>
              <Button variant="outline" className="flex-1" onClick={() => window.open(paypalDonationUrl, '_blank')}>Open PayPal</Button>
            </div>
          </div>

          {donorIntent ? (
            <div className="mt-4 rounded-lg border border-border p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Reference token</div>
              <div className="font-mono text-sm">{donorIntent.reference_token}</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {donorIntent.instructions.map((instruction) => (
                  <li key={instruction}>• {instruction}</li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Manual verification target: within 24 hours. Access is granted for {donorIntent.grant_days} days per matched donation.
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <input
              value={donorTransactionId}
              onChange={(event) => setDonorTransactionId(event.target.value)}
              placeholder="Paste PayPal transaction ID"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button size="sm" onClick={handleSubmitTransactionHint}>I have paid</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
