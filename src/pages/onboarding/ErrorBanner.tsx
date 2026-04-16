import { XCircle } from "lucide-react";

/** Inline error banner used across onboarding steps. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

/** Simple full-width error banner (no icon) for card forms. */
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
      {message}
    </div>
  );
}
