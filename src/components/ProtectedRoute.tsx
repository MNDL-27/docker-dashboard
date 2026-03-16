import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

export function ProtectedRoute({ 
  children, 
  requireOnboarded = true 
}: { 
  children: React.ReactNode, 
  requireOnboarded?: boolean 
}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authState, setAuthState] = useState<{
    status: "loading" | "approved" | "denied";
    hasOrgs: boolean;
  }>({ status: "loading", hasOrgs: false });

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
          if (!cancelled) setAuthState({ status: "denied", hasOrgs: false });
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAuthState({
            status: data.user?.is_approved ? "approved" : "denied",
            hasOrgs: !!data.user?.has_orgs
          });
        }
      } catch {
        if (!cancelled) setAuthState({ status: "denied", hasOrgs: false });
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || (isSignedIn && authState.status === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (authState.status === "denied") {
    return <Navigate to="/beta-gate" replace />;
  }

  // At this point, the user is signed in AND approved via auth/me
  // 1. If hitting a main app route but user has no orgs, force them to onboarding
  if (requireOnboarded && !authState.hasOrgs) {
    return <Navigate to="/onboarding" replace />;
  }

  // 2. If hitting onboarding specifically but user already has orgs, force them into the app
  if (!requireOnboarded && authState.hasOrgs) {
    return <Navigate to="/app" replace />;
  }

  // 3. Otherwise, render the requested route normally
  return <>{children}</>;
}
