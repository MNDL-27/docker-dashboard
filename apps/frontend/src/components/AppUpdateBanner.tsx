import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { cn } from "@/lib/utils";

/**
 * A fixed-position banner that appears at the bottom of the viewport when a
 * new version of the app has been deployed. Offers the user a one-click
 * "Reload" action so they always see the latest code.
 */
export function AppUpdateBanner() {
  const { updateAvailable, reload, dismiss } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      id="app-update-banner"
      role="alert"
      className={cn(
        "fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2",
        "flex items-center gap-3 rounded-xl border border-cyan-500/30 px-5 py-3",
        "bg-gradient-to-r from-cyan-950/90 via-slate-900/95 to-cyan-950/90",
        "shadow-[0_4px_24px_rgba(0,200,255,0.15)] backdrop-blur-md",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        "max-w-[90vw] sm:max-w-md"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
        <RefreshCw className="h-4 w-4 text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cyan-50">
          New version available
        </p>
        <p className="text-xs text-cyan-300/70 truncate">
          Reload to get the latest features &amp; fixes.
        </p>
      </div>

      <button
        id="app-update-reload-btn"
        onClick={reload}
        className={cn(
          "shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold",
          "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        )}
      >
        Reload
      </button>

      <button
        id="app-update-dismiss-btn"
        onClick={dismiss}
        aria-label="Dismiss update notification"
        className={cn(
          "shrink-0 rounded-md p-1 text-cyan-400/60 hover:text-cyan-300",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
