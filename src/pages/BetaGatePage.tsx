import { useClerk, useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Box, ShieldCheck, LogOut, Mail } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogoLink } from "@/components/shared/LogoLink";
import { deriveNeedsOnboarding, normalizeOnboardingStatus } from "@/lib/onboarding-gate";

// ─── TEMPORARY DEV BYPASS ───
// Set to `false` to re-enable the private beta approval gate.
const BYPASS_BETA_GATE = true;

export default function BetaGatePage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();

  const [appState, setAppState] = useState<{
    status: "loading" | "resolved";
    isApproved: boolean;
    hasOrgs: boolean;
    needsOnboarding: boolean;
  }>({ status: "loading", isApproved: false, hasOrgs: false, needsOnboarding: true });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const checkAuth = async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 202) {
          const data = await res.json().catch(() => ({}));
          if (data?.retry) {
            return;
          }
        }

        if (!res.ok) {
          setAppState({ status: "resolved", isApproved: false, hasOrgs: false, needsOnboarding: true });
          return;
        }
        const data = await res.json();
        const isApproved = !!data.user?.is_approved;
        const hasOrgs = !!data.user?.has_orgs;
        const onboardingStatus = normalizeOnboardingStatus(data.user?.onboarding_status);
        const needsOnboarding = deriveNeedsOnboarding(hasOrgs, onboardingStatus);
        setAppState({ status: "resolved", isApproved, hasOrgs, needsOnboarding });

        // If approved, stop polling and redirect
        if (isApproved) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          navigate(needsOnboarding ? "/onboarding" : "/app", { replace: true });
        }
      } catch {
        setAppState({ status: "resolved", isApproved: false, hasOrgs: false, needsOnboarding: true });
      }
    };

    // Initial check
    checkAuth();

    // Poll every 5s while the page is open
    pollRef.current = setInterval(checkAuth, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoaded, isSignedIn, getToken, navigate]);

  // Clerk still loading
  if (!isLoaded || (isSignedIn && appState.status === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  // ─── TEMPORARY DEV BYPASS: skip the gate, redirect forward ───
  if (BYPASS_BETA_GATE) {
    return <Navigate to={appState.needsOnboarding ? "/onboarding" : "/app"} replace />;
  }

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <LogoLink className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Box className="h-6 w-6 text-primary-foreground" />
          </div>
        </LogoLink>

        {/* Shield icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">Private Beta</h1>
          <p className="text-muted-foreground leading-relaxed">
            Thanks for your interest! We're currently in a private beta and access
            is limited to approved accounts only.
          </p>
        </div>

        {/* User email card */}
        {email && (
          <div className="glass-card p-4 flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{email}</p>
            </div>
          </div>
        )}

        {/* Info */}
        <p className="text-sm text-muted-foreground">
          Your access request has been noted. We'll notify you at this email
          when your account is approved.
        </p>

        {/* Sign out */}
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
