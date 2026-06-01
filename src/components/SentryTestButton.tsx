import * as Sentry from "@sentry/react";
import { Bug } from "lucide-react";

export function SentryTestButton() {
  return (
    <Sentry.ErrorBoundary
      fallback={<p className="text-xs text-destructive">Error caught by Sentry</p>}
    >
      <button
        onClick={() => {
          throw new Error("Sentry test error — source maps should now work!");
        }}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Bug className="h-3 w-3" />
        Test Sentry
      </button>
    </Sentry.ErrorBoundary>
  );
}
