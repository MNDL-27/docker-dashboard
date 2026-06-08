import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface DashboardConnectionErrorStateProps {
  organizationName?: string;
  errorMessage?: string;
}

export function DashboardConnectionErrorState({ organizationName, errorMessage }: DashboardConnectionErrorStateProps) {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <PageHeader title="Dashboard" description={organizationName || "Overview"} />
      <div className="glass-card p-12 text-center max-w-lg mx-auto border-destructive/20 bg-destructive/5">
        <AlertTriangle className="h-12 w-12 text-destructive/60 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
          Unable to reach the server. Your hosts are registered but their current status cannot be verified.
        </p>
        {errorMessage && (
          <p className="text-xs text-muted-foreground/60 mb-8 font-mono">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
