import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { useViewerState, type ViewerState } from "@/hooks/useViewerState";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarded?: boolean;
  allowMissingOrganization?: boolean;
  skipResolvedRedirect?: boolean;
}

/**
 * Main application routing gate.
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
  
  const { data: viewer, isLoading, error } = useViewerState();

  if (previewBypass) return <>{children}</>;

  if (!isLoaded || isLoading) {
    return <FullScreenLoader />;
  }

  if (!isSignedIn || !viewer) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return <AuthErrorState />;
  }

  const redirect = getRedirectTarget({
    viewer,
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

function getRedirectTarget({
  viewer,
  pathname,
  requireOnboarded,
  allowMissingOrganization,
  skipResolvedRedirect
}: {
  viewer: ViewerState;
  pathname: string;
  requireOnboarded: boolean;
  allowMissingOrganization: boolean;
  skipResolvedRedirect: boolean;
}): string | null {
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isDedicatedIntakeRoute = pathname.startsWith("/dedicated/intake");
  const isDedicatedStatusRoute = pathname.startsWith("/app/dedicated-deployment");

  const deploymentInProgress = isDeploymentBlocked(viewer.dedicated_deployment_status);

  const shouldBlockForDeployment =
    deploymentInProgress && !isDedicatedStatusRoute && !isDedicatedIntakeRoute;

  const needsOrgCreation =
    !viewer.has_orgs && !allowMissingOrganization && !isOnboardingRoute;

  const shouldForceOnboarding =
    requireOnboarded && viewer.has_orgs && viewer.needs_onboarding &&
    !deploymentInProgress && !isOnboardingRoute;

  const onboardingAlreadyComplete =
    !requireOnboarded && !skipResolvedRedirect && viewer.has_orgs &&
    !viewer.needs_onboarding && !deploymentInProgress;

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
