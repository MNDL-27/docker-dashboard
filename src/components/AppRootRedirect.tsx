import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";

/**
 * Root redirect for the app subdomain (app.dockerdash.app).
 *
 * - Signed in  → /app  (dashboard)
 * - Signed out → /login
 * - Loading    → spinner
 */
export default function AppRootRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const previewBypass = isPreviewAuthBypassEnabled();

  if (previewBypass) {
    return <Navigate to="/app" replace />;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/login" replace />;
}
