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
  
  const { data: viewer, isLoading: isViewerLoading, error } = useViewerState();

  if (previewBypass) return <>{children}</>;

  // 1. Wait for Clerk to determine initial auth state
  if (!isLoaded) {
    return <FullScreenLoader />;
  }

  // 2. If not signed in, redirect to login immediately
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // 3. Handle backend errors or missing viewer data
  if (error) {
    return <AuthErrorState error={error} />;
  }

  // 4. Wait for the viewer profile fetch (which is now enabled since isLoaded && isSignedIn is true)
  if (isViewerLoading) {
    return <FullScreenLoader />;
  }

  // Handle cases where the backend returns a successful response but with an error code (e.g. 202 SYNC_PENDING)
  const isSyncing = (viewer as unknown as Record<string, unknown>)?.code === 'SYNC_PENDING';
  if (isSyncing) {
    return <FullScreenLoader message="Syncing your account..." />;
  }

  if (!viewer) {
    return <Navigate to="/login" replace />;
  }

  const redirect = getRedirectTarget({
    viewer,
    pathname: location.pathname,
    requireOnboarded,
    allowMissingOrganization,
    skipResolvedRedirect
  });

  if (redirect && redirect !== location.pathname) {
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

function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-xs text-muted-foreground animate-pulse">{message}</p>}
    </div>
  );
}

function AuthErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4">
      <div className="rounded-full bg-destructive/10 p-3">
        <div className="w-6 h-6 text-destructive flex items-center justify-center font-bold">!</div>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium">Unable to verify your account</p>
        <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-xs font-semibold text-primary hover:underline bg-primary/5 px-4 py-2 rounded-lg transition-colors"
      >
        Retry Authentication
      </button>
    </div>
  );
}
