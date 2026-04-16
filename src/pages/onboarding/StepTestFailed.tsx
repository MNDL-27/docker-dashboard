import { AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hostName: string;
  testError: string;
  onRetry: () => void;
  onFinishLater: () => void;
}

/** Step 1 — host saved but connection test failed. */
export function StepTestFailed({ hostName, testError, onRetry, onFinishLater }: Props) {
  return (
    <div className="animate-fade-in w-full">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-7 w-7 text-warning" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          Host saved, connection not verified
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          <strong>"{hostName}"</strong> was saved to your workspace, but the connection test didn't pass.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
        {/* Error detail */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-warning/20 bg-warning/5">
          <XCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-warning leading-relaxed">{testError || "Connection test failed."}</div>
        </div>

        <TroubleshootingHints />

        <div className="border-t border-border" />

        <div className="flex gap-3">
          <Button variant="outline" className="h-11" onClick={onRetry}>
            Retry Connection
          </Button>
          <Button
            className="flex-1 h-11 text-base"
            variant="secondary"
            onClick={onFinishLater}
          >
            Finish Later
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          You can retry or edit this host anytime from <strong>Hosts</strong> in the dashboard.
        </p>
      </div>
    </div>
  );
}

/* ── Troubleshooting checklist ── */
function TroubleshootingHints() {
  return (
    <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
      <p>Common causes:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Agent is not running on the host</li>
        <li>Firewall blocking HTTPS traffic to the agent port</li>
        <li>API key mismatch between dashboard and agent</li>
        <li>URL or port is incorrect</li>
      </ul>
    </div>
  );
}
