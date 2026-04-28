import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { useAuthMe, type AuthMeState } from "@/hooks/useAuthMe";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarded?: boolean;
  allowMissingOrganization?: boolean;
  skipResolvedRedirect?: boolean;
}

/**
 * Main application routing gate.
 * 
 * Responsibilities:
 * 1. Clerk Auth Verification
 * 2. Backend State Sync (/api/auth/me)
 * 3. Dedicated Deployment Blocking
 * 4. Onboarding & Org Requirements
 */
export function ProtectedRoute({
  children,
  requireOnboarded = true,
  allowMissingOrganization = false,
  skipResolvedRedirect = false,
}: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const previewBypass = isPreviewAuthBypassEnabled();
  
  // Custom hook encapsulates fetch/retry/polling logic (flattens CC)
  const authMe = useAuthMe(!previewBypass);

  // 1. System-level bypass (Previews/Local Dev)
  if (previewBypass) return <>{children}</>;

  // 2. Auth Loading State
  if (!isLoaded || authMe.status === "loading") {
    return <FullScreenLoader />;
  }

  // 3. Unauthenticated State
  if (!isSignedIn || authMe.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  // 4. Backend Synchronization Error
  if (authMe.status === "error") {
    return <AuthErrorState />;
  }

  // 5. State-driven Redirect Logic (flattens "Bumpy Road")
  const redirect = getRedirectTarget({
    state: authMe,
    pathname: location.pathname,
    requireOnboarded,
    allowMissingOrganization,
    skipResolvedRedirect
  });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

/**
 * Pure helper to determine redirect target based on application state.
 */
function getRedirectTarget({
  state,
  pathname,
  requireOnboarded,
  allowMissingOrganization,
  skipResolvedRedirect
}: {
  state: AuthMeState;
  pathname: string;
  requireOnboarded: boolean;
  allowMissingOrganization: boolean;
  skipResolvedRedirect: boolean;
}): string | null {
  // --- Route classification ---
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isDedicatedIntakeRoute = pathname.startsWith("/dedicated/intake");
  const isDedicatedStatusRoute = pathname.startsWith("/app/dedicated-deployment");

  // --- Business rule predicates ---
  const deploymentInProgress = isDeploymentBlocked(state.dedicatedDeploymentStatus);

  const shouldBlockForDeployment =
    deploymentInProgress && !isDedicatedStatusRoute && !isDedicatedIntakeRoute;

  const needsOrgCreation =
    !state.hasOrgs && !allowMissingOrganization && !isOnboardingRoute;

  const shouldForceOnboarding =
    requireOnboarded && state.hasOrgs && state.needsOnboarding &&
    !deploymentInProgress && !isOnboardingRoute;

  const onboardingAlreadyComplete =
    !requireOnboarded && !skipResolvedRedirect && state.hasOrgs &&
    !state.needsOnboarding && !deploymentInProgress;

  // --- Redirect decision (first match wins) ---
  if (shouldBlockForDeployment) return "/app/dedicated-deployment";
  if (needsOrgCreation) return "/onboarding";
  if (shouldForceOnboarding) return "/onboarding";
  if (onboardingAlreadyComplete) return "/app";

  return null;
}

/** Deployment is blocked when status exists but isn't in a terminal state. */
function isDeploymentBlocked(status: string | null): boolean {
  if (status === null) return false;
  const terminalStates = ["ready_for_handoff", "active"];
  return !terminalStates.includes(status);
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AuthErrorState() {
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
