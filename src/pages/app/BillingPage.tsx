import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Zap, Box, HeartHandshake, Rocket, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useOrganization, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getPricingPlan } from "@/lib/pricing";
import { useViewerState } from "@/hooks/useViewerState";

export default function BillingPage() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { user } = useUser();
  const { data: viewer, isLoading: viewerLoading } = useViewerState();
  const { toast } = useToast();
  const [donorIntentLoading, setDonorIntentLoading] = useState(false);
  const [donorIntent, setDonorIntent] = useState<null | {
    reference_token: string;
    instructions: string[];
    grant_days: number;
  }>(null);
  const [donorTransactionId, setDonorTransactionId] = useState("");
  const freePlanDetails = getPricingPlan("free");
  const activeOrganizationId = viewer?.active_org_id ?? null;
  const effectivePlan = viewer?.active_org_effective_plan ?? viewer?.active_org_plan;

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
          intended_plan: 'pro',
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

  if (viewerLoading || (Boolean(activeOrganizationId) && isLoading)) {
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
                <span>{orgDetails.payment_provider ? `${orgDetails.payment_provider} managed` : 'Platform managed'}</span>
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
              <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/MNDL-27/docker-watchtower-dash/issues', '_blank')}>
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

        <div className="glass-card p-8">
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

        <div className="glass-card p-8">
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
            <p className="text-sm mb-4">Need advanced alerting, more seats, or a support response target? Upgrade to Pro or Team.</p>
            <Button className="w-full" onClick={() => navigate('/pricing')}>Compare Plans →</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold">Pro Plan</h3>
                <p className="text-xs text-muted-foreground">For individual operators</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Unlimited hosts, premium alerting, file manager, SSH-over-HTTP, and dedicated support response target.
            </p>
            <Button className="w-full gap-2" variant="default" onClick={() => window.open('https://github.com/MNDL-27/docker-watchtower-dash/issues/new?template=upgrade_request.md&title=Pro+plan+upgrade+request', '_blank')}>
              <Mail className="h-4 w-4" /> Request Pro Upgrade
            </Button>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold">Team Plan</h3>
                <p className="text-xs text-muted-foreground">For teams and organizations</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Everything in Pro plus team member seats, dedicated deployment options, and priority support.
            </p>
            <Button className="w-full gap-2" variant="default" onClick={() => window.open('https://github.com/MNDL-27/docker-watchtower-dash/issues/new?template=upgrade_request.md&title=Team+plan+upgrade+request', '_blank')}>
              <Mail className="h-4 w-4" /> Request Team Upgrade
            </Button>
          </div>
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
