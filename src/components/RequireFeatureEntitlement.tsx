import { Navigate } from "react-router-dom";
import { useViewerState } from "@/hooks/useViewerState";
import type { ViewerEntitlements } from "@/hooks/useViewerState";

interface RequireFeatureEntitlementProps {
  children: React.ReactNode;
  feature: keyof Pick<
    ViewerEntitlements,
    "canUseTeamCollaboration" | "canUseSlackDestinations" | "canUseWebhookDestinations" | "canUseAdvancedAlerts"
  >;
  fallbackPath?: string;
}

export function RequireFeatureEntitlement({
  children,
  feature,
  fallbackPath = "/app/billing",
}: RequireFeatureEntitlementProps) {
  const { data: viewer, isLoading } = useViewerState();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!viewer?.entitlements?.[feature]) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
