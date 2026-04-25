import { useAuth, useClerk } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";
import { normalizeOnboardingStatus, deriveNeedsOnboarding, type OnboardingStatus } from "@/lib/onboarding-gate";

export interface AuthMeState {
  status: "loading" | "resolved" | "error" | "unauthenticated";
  hasOrgs: boolean;
  onboardingStatus: OnboardingStatus;
  needsOnboarding: boolean;
  activeOrgPlan: string | null;
  dedicatedDeploymentStatus: string | null;
}

const initialState: AuthMeState = {
  status: "loading",
  hasOrgs: false,
  onboardingStatus: null,
  needsOnboarding: true,
  activeOrgPlan: null,
  dedicatedDeploymentStatus: null,
};

const unauthenticatedState: AuthMeState = {
  status: "unauthenticated",
  hasOrgs: false,
  onboardingStatus: null,
  needsOnboarding: true,
  activeOrgPlan: null,
  dedicatedDeploymentStatus: null,
};

export function useAuthMe(enabled: boolean) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [state, setState] = useState<AuthMeState>(initialState);

  const fetchAuthMe = useCallback(async (cancelled: { current: boolean }) => {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const token = await getToken({ skipCache: attempt > 1 });

        if (!token) {
          if (!cancelled.current) setState(unauthenticatedState);
          return;
        }

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // 202 Accepted: Initial setup in progress, retry
        if (res.status === 202) {
          const data = await res.json().catch(() => ({}));
          if (data?.retry) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
        }

        // 401 Unauthorized: Session invalid or expired
        if (res.status === 401) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            continue;
          }

          if (!cancelled.current) setState(unauthenticatedState);
          await signOut({ redirectUrl: "/login?reauth=1" }).catch(() => {
            window.location.assign("/login?reauth=1");
          });
          return;
        }

        if (!res.ok) {
          throw new Error(`auth/me failed (${res.status})`);
        }

        const data = await res.json();
        const hasOrgs = !!data.user?.has_orgs;
        const onboardingStatus = normalizeOnboardingStatus(data.user?.onboarding_status);
        const needsOnboarding = deriveNeedsOnboarding(hasOrgs, onboardingStatus);

        if (!cancelled.current) {
          setState({
            status: "resolved",
            hasOrgs,
            onboardingStatus,
            needsOnboarding,
            activeOrgPlan: data.user?.active_org_plan ?? null,
            dedicatedDeploymentStatus: data.user?.dedicated_deployment_status ?? null,
          });
        }
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          continue;
        }

        if (!cancelled.current) {
          setState((prev) => ({ ...prev, status: "error" }));
        }
      }
    }
  }, [getToken, signOut]);

  useEffect(() => {
    if (!enabled || !isLoaded) return;

    if (!isSignedIn) {
      setState(unauthenticatedState);
      return;
    }

    const cancelled = { current: false };
    fetchAuthMe(cancelled);

    return () => {
      cancelled.current = true;
    };
  }, [enabled, isLoaded, isSignedIn, fetchAuthMe]);

  return state;
}
