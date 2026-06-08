import { Loader2 } from "lucide-react";

interface DashboardLoadingStateProps {
  size?: "sm" | "md";
}

export function DashboardLoadingState({ size = "md" }: DashboardLoadingStateProps) {
  const loaderClassName = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className={`${loaderClassName} animate-spin text-primary/40`} />
    </div>
  );
}

