import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@clerk/react";

export interface ViewerEntitlements {
  plan: "free" | "pro" | "team" | "enterprise";
  subscriptionStatus: "active" | "inactive" | "past_due" | "canceled" | "paused";
  isPaidSubscriptionActive: boolean;
  isDonorPremium: boolean;
  seatLimit: number | null;
  nodeLimit: number | null;
  orgLimit: number | null;
  canUseWebhookDestinations: boolean;
  canUseSlackDestinations: boolean;
  canUseAdvancedAlerts: boolean;
  canUseTeamCollaboration: boolean;
  canUseLogs: boolean;
  canUseFileManager: boolean;
}

export interface ViewerState {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  has_orgs: boolean;
  needs_onboarding: boolean;
  onboarding_status: string | null;
  active_org_id: string | null;
  active_org_clerk_id: string | null;
  active_org_plan: string | null;
  active_org_effective_plan: string | null;
  dedicated_deployment_status: string | null;
  dedicated_deployment_updated_at: string | null;
  is_platform_admin: boolean;
  is_suspended: boolean;
  is_hard_disabled: boolean;
  entitlements: ViewerEntitlements | null;
}

export function useViewerState() {
  const { isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const data = await apiFetch('/auth/me');
      return data.user as ViewerState;
    },
    enabled: isLoaded && isSignedIn,
    retry: false,
    staleTime: 30_000,
  });
}
