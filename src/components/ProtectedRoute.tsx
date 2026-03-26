import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

// ─── TEMPORARY DEV BYPASS ───
// Set to `false` to re-enable the private beta approval gate.
const BYPASS_BETA_GATE = true;

export function ProtectedRoute({ 
  children, 
  requireOnboarded = true 
}: { 
  children: React.ReactNode, 
  requireOnboarded?: boolean 
}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authState, setAuthState] = useState<{
    status: "loading" | "resolved";
    isApproved: boolean;
    hasOrgs: boolean;
    needsOnboarding: boolean;
  }>({ status: "loading", isApproved: false, hasOrgs: false, needsOnboarding: true });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // API error (user not synced yet, network issue, etc.) — treat as unapproved
          if (!cancelled) setAuthState({ status: "resolved", isApproved: false, hasOrgs: false, needsOnboarding: true });
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAuthState({
            status: "resolved",
            isApproved: !!data.user?.is_approved,
            hasOrgs: !!data.user?.has_orgs,
            needsOnboarding: !!data.user?.needs_onboarding,
          });
        }
      } catch {
        if (!cancelled) setAuthState({ status: "resolved", isApproved: false, hasOrgs: false, needsOnboarding: true });
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken]);

  // ── Priority 1: Show loading while Clerk or auth/me is resolving ──
  if (!isLoaded || (isSignedIn && authState.status === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Priority 2: Redirect unauthenticated users to login ──
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // ── Priority 3: Redirect unapproved users to beta gate ──
  // This MUST happen before any onboarding/org checks.
  // An unapproved user must never reach onboarding, regardless of requireOnboarded.
  if (!BYPASS_BETA_GATE && !authState.isApproved) {
    return <Navigate to="/beta-gate" replace />;
  }

  // ── Priority 4: Onboarding gate (only for approved users) ──
  // Main app routes require onboarding to be finished (completed or skipped)
  if (requireOnboarded && authState.needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // If hitting onboarding but onboarding is already complete/skipped, force app
  if (!requireOnboarded && !authState.needsOnboarding) {
    return <Navigate to="/app" replace />;
  }

  // ── Priority 5: Render the requested route ──
  return <>{children}</>;
}

