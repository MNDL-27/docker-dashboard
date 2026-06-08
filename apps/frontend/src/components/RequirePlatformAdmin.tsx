import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useViewerState } from "@/hooks/useViewerState";

export function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { data: viewer, isLoading, error } = useViewerState();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !viewer?.is_platform_admin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
