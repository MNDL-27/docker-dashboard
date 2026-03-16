import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [approvalState, setApprovalState] = useState<"loading" | "approved" | "denied">("loading");

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
          if (!cancelled) setApprovalState("denied");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setApprovalState(data.user?.is_approved ? "approved" : "denied");
        }
      } catch {
        if (!cancelled) setApprovalState("denied");
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || (isSignedIn && approvalState === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (approvalState === "denied") {
    return <Navigate to="/beta-gate" replace />;
  }

  return <>{children}</>;
}
