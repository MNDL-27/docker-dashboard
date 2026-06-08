import { AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hostName: string;
  testError: string;
  remediationCommand?: string | null;
  onRetry: () => void;
  onFinishLater: () => void;
}

export function StepTestFailed({
  hostName,
  testError,
  remediationCommand,
  onRetry,
  onFinishLater,
}: Props) {
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
          <strong>"{hostName}"</strong> was saved to your workspace, but the connection test did not pass.
        </p>
      </div>

      <div className="glass-card-raised p-8 space-y-6">
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-warning/20 bg-warning/5">
          <XCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-warning leading-relaxed">{testError || "Connection test failed."}</div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <p>Common causes:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Agent is not running on the host</li>
            <li>Firewall or tunnel rules are blocking the agent endpoint</li>
            <li>API key mismatch between Dockerdash and the agent</li>
            <li>URL, port, or Cloudflare Access configuration is incorrect</li>
          </ul>
          {remediationCommand ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 font-medium text-foreground">Suggested remediation command</p>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground/90">{remediationCommand}</pre>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border" />

        <div className="flex gap-3">
          <Button variant="outline" className="h-11" onClick={onRetry}>
            Retry Connection
          </Button>
          <Button className="flex-1 h-11 text-base" variant="secondary" onClick={onFinishLater}>
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
