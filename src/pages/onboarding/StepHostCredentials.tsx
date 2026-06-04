import { useState } from "react";
import { ShieldCheck, ArrowRight, ArrowLeft, Terminal, Copy, Eye, EyeOff, RefreshCw, Wrench, CloudCog, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "./ErrorBanner";
import { CONNECTION_MODES } from "./useOnboardingState";
import type { ConnectionMode } from "@/types/database";

/* ── Icon map for connection mode cards ── */
const MODE_ICONS: Record<ConnectionMode, typeof Terminal> = {
  agent: Terminal,
  http: Terminal,
  cloudflare_tunnel: CloudCog,
};

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  hostUrl: string;
  onHostUrlChange: (v: string) => void;
  connectionMode: ConnectionMode;
  onConnectionModeChange: (v: ConnectionMode) => void;
  modeLabel: string;
  installCommand: string;
  verifyCommand: string;
  setupSummary: string;
  verifySummary: string;
  next_step_summary: string;
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

/* ── Connection Mode Card Selector (extracted sub-component) ── */
function ConnectionModeSelector({
  connectionMode,
  onConnectionModeChange,
}: {
  connectionMode: ConnectionMode;
  onConnectionModeChange: (v: ConnectionMode) => void;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Connection Method</Label>
      <Select value={connectionMode} onValueChange={(val: string) => onConnectionModeChange(val as ConnectionMode)}>
        <SelectTrigger className="h-14 bg-background w-full">
          <SelectValue placeholder="Select a connection method" />
        </SelectTrigger>
        <SelectContent>
          {CONNECTION_MODES.map((m) => {
            const Icon = MODE_ICONS[m.value];
            return (
              <SelectItem key={m.value} value={m.value} className="py-3 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-semibold leading-none">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.desc}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StepHostCredentials({
  hostUrl, onHostUrlChange,
  connectionMode, onConnectionModeChange,
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
          Setup the Agent
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          Follow the steps below to get your host connected to Dockerdash.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Install */}
        <div className="glass-card-raised p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">1</div>
            <h2 className="text-xl font-bold">Install & Verify</h2>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Run this one-liner on your Docker host to install the lightweight agent service.
          </p>

          <CopyCommand label="Run this command" command={installCommand} />

          <Accordion type="single" collapsible className="w-full border rounded-xl overflow-hidden bg-muted/20">
            <AccordionItem value="verify" className="border-none">
              <AccordionTrigger className="px-4 py-2 hover:no-underline text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold">
                  <Wrench className="h-3.5 w-3.5" />
                  Optional: Verify locally
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3 border-t">
                <p className="text-[11px] text-muted-foreground mt-2">Confirm the agent is listening locally before continuing:</p>
                <CopyCommand label="Local verify command" command={verifyCommand} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate installer
            </Button>
            {expiresAt ? <span className="text-[10px] text-muted-foreground">Command expires: {new Date(expiresAt).toLocaleTimeString()}</span> : null}
          </div>
        </div>

        {/* Step 2: Configure Access */}
        <div className="glass-card-raised p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">2</div>
            <h2 className="text-xl font-bold">Configure Access</h2>
          </div>

          <ConnectionModeSelector
            connectionMode={connectionMode}
            onConnectionModeChange={onConnectionModeChange}
          />

          <div className="space-y-3 pt-2">
            <Label htmlFor="host-url" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
              {connectionMode === "cloudflare_tunnel" ? "Tunnel URL" : connectionMode === "http" ? "Public HTTP Agent URL" : "Public Agent URL"}
            </Label>
            <Input
              id="host-url"
              placeholder={connectionMode === "cloudflare_tunnel" ? "https://docker.your-team.cloudflareaccess.com" : connectionMode === "http" ? "http://agent.example.com:9876" : "https://agent.example.com:9876"}
              value={hostUrl}
              onChange={(e) => onHostUrlChange(e.target.value)}
              className="h-11 bg-background"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {connectionMode === "cloudflare_tunnel"
                ? "The Cloudflare Tunnel hostname. Ensure it routes to http://127.0.0.1:9876 on the host."
                : connectionMode === "http"
                  ? "The external HTTP URL of your agent. Ensure your firewall/proxy routes traffic to port 9876."
                  : "The external HTTPS URL of your agent. Ensure your firewall/proxy routes traffic to port 9876."}
            </p>
          </div>

          {connectionMode === "cloudflare_tunnel" ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 mt-4">
              <CloudCog className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Tunnel Routing Note</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Route your hostname to <code className="bg-muted px-1 rounded font-mono text-foreground">http://127.0.0.1:9876</code>.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-foreground"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <Wrench className="h-4 w-4 text-primary" />
            {showAdvanced ? "Hide advanced details" : "Advanced manual options"}
          </button>
          {showAdvanced ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[11px] text-muted-foreground">
                Embedded long-lived API key fallback. Use only for non-interactive automation.
              </p>
              <CopyCommand label="Manual install (embedded key)" command={advancedManualCommand} masked />
            </div>
          ) : null}
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" className="h-12 px-6" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" 
            size="lg" 
            onClick={onFinalize}
            disabled={!hostUrl.trim()}
          >
            Finish & Verify Connection
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
