import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { deriveNeedsOnboarding, normalizeOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding-gate";

export function ProtectedRoute({
  children,
  requireOnboarded = true,
  allowMissingOrganization = false,
  skipResolvedRedirect = false,
}: {
  children: React.ReactNode;
  requireOnboarded?: boolean;
  allowMissingOrganization?: boolean;
  skipResolvedRedirect?: boolean;
}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authState, setAuthState] = useState<{
    status: "loading" | "resolved" | "error" | "unauthenticated";
    hasOrgs: boolean;
    onboardingStatus: OnboardingStatus;
    needsOnboarding: boolean;
    activeOrgPlan: string | null;
    dedicatedDeploymentStatus: string | null;
  }>({
    status: "loading",
    hasOrgs: false,
    onboardingStatus: null,
    needsOnboarding: true,
    activeOrgPlan: null,
    dedicatedDeploymentStatus: null,
  });

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setAuthState({
        status: "unauthenticated",
        hasOrgs: false,
        onboardingStatus: null,
        needsOnboarding: true,
        activeOrgPlan: null,
        dedicatedDeploymentStatus: null,
      });
      return;
    }

    let cancelled = false;

    (async () => {
      const maxAttempts = 5;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const token = await getToken();

          if (!token) {
            if (!cancelled) {
              setAuthState({
                status: "unauthenticated",
                hasOrgs: false,
                onboardingStatus: null,
                needsOnboarding: true,
                activeOrgPlan: null,
                dedicatedDeploymentStatus: null,
              });
            }
            return;
          }

          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.status === 202) {
            const data = await res.json().catch(() => ({}));
            if (data?.retry) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }
          }

          if (res.status === 401) {
            if (attempt < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
              continue;
            }

            if (!cancelled) {
              setAuthState((prev) => ({
                ...prev,
                status: "error",
              }));
            }
            return;
          }

          if (!res.ok) {
            throw new Error(`auth/me failed (${res.status})`);
          }

          const data = await res.json();
          const hasOrgs = !!data.user?.has_orgs;
          const onboardingStatus = normalizeOnboardingStatus(data.user?.onboarding_status);
          const needsOnboarding = deriveNeedsOnboarding(hasOrgs, onboardingStatus);

          if (!cancelled) {
            setAuthState({
              status: "resolved",
              hasOrgs,
              onboardingStatus,
              needsOnboarding,
              activeOrgPlan: data.user?.active_org_plan ?? null,
              dedicatedDeploymentStatus: data.user?.dedicated_deployment_status ?? null,
            });
          }
          return;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            continue;
          }

          if (!cancelled) {
            setAuthState((prev) => ({
              ...prev,
              status: "error",
            }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn || authState.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (authState.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSignedIn && authState.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4">
        <p className="text-sm text-muted-foreground text-center">Unable to verify onboarding status right now.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const pathname = window.location.pathname;
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isDedicatedIntakeRoute = pathname.startsWith("/dedicated/intake");
  const isDedicatedStatusRoute = pathname.startsWith("/app/dedicated-deployment");
  const dedicatedStatus = authState.dedicatedDeploymentStatus;
  const deploymentBlocked =
    dedicatedStatus !== null &&
    dedicatedStatus !== "ready_for_handoff" &&
    dedicatedStatus !== "active";

  if (deploymentBlocked && !isDedicatedStatusRoute && !isDedicatedIntakeRoute) {
    return <Navigate to="/app/dedicated-deployment" replace />;
  }

  if (!authState.hasOrgs && !allowMissingOrganization) {
    if (!isOnboardingRoute) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  if (authState.hasOrgs && requireOnboarded && authState.needsOnboarding && !deploymentBlocked) {
    if (!isOnboardingRoute) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  if (!requireOnboarded && !skipResolvedRedirect && authState.hasOrgs && !authState.needsOnboarding && !deploymentBlocked) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
