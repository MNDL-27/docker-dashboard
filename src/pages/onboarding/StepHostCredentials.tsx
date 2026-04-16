import { useState } from "react";
import { ShieldCheck, ArrowRight, ArrowLeft, Terminal, Copy, Eye, EyeOff, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "./ErrorBanner";
import type { ConnectionMode } from "@/types/database";

interface Props {
  connectionMode: ConnectionMode;
  modeLabel: string;
  installCommand: string;
  verifyCommand: string;
  setupSummary: string;
  verifySummary: string;
  nextStepSummary: string;
  advancedManualCommand: string;
  expiresAt: string | null;
  error: string | null;
  onBack: () => void;
  onFinalize: () => void;
  onRegenerate: () => void;
}

function CopyCommand({
  label,
  command,
  masked = false,
}: {
  label: string;
  command: string;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  const visibleCommand = masked && !revealed ? command.replace(/[A-Fa-f0-9]{32,}/g, "••••••••••••••••••••••••••••••••") : command;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          {masked ? (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setRevealed((value) => !value)}>
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? "Hide" : "Reveal"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-xs leading-relaxed">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{visibleCommand}</pre>
      </div>
    </div>
  );
}

export function StepHostCredentials({
  connectionMode,
  modeLabel,
  installCommand,
  verifyCommand,
  setupSummary,
  verifySummary,
  nextStepSummary,
  advancedManualCommand,
  expiresAt,
  error,
  onBack,
  onFinalize,
  onRegenerate,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="animate-fade-in w-full">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Install the agent
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          {modeLabel} is ready. Run the generated command on your Linux Docker host, verify locally, then finish setup in Dockerdash.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
          {setupSummary}
        </div>

        <CopyCommand label="Primary install command" command={installCommand} />

        <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>{verifySummary}</p>
          <p>{nextStepSummary}</p>
          {expiresAt ? <p>Enrollment command expires at {new Date(expiresAt).toLocaleString()}.</p> : null}
        </div>

        <CopyCommand label="Local verify command" command={verifyCommand} />

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-foreground"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <Wrench className="h-4 w-4 text-primary" />
            {showAdvanced ? "Hide manual fallback" : "Use manual install instead"}
          </button>
          {showAdvanced ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This advanced command embeds the long-lived agent API key. Use it only if you do not want the enrollment-token flow.
              </p>
              <CopyCommand label="Advanced manual install" command={advancedManualCommand} masked />
            </div>
          ) : null}
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-3">
          <Button variant="outline" className="h-11" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button variant="outline" className="h-11 gap-2" onClick={onRegenerate}>
            <RefreshCw className="h-4 w-4" />
            Regenerate command
          </Button>
          <Button className="flex-1 h-11 text-base" size="lg" onClick={onFinalize}>
            Finish setup
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
          <p>
            The guided flow keeps the long-lived API key out of the default copied command.
          </p>
          <p>
            Recommended bind for {connectionMode === "cloudflare_tunnel" ? "Cloudflare Tunnel" : "direct agent"} mode is applied automatically in the generated installer command.
          </p>
        </div>
      </div>
    </div>
  );
}
