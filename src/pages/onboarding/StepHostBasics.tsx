import { Server, ArrowRight, Check, Info, Terminal, CloudCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "./ErrorBanner";
import type { ConnectionMode } from "@/types/database";
import { CONNECTION_MODES } from "./useOnboardingState";

interface Props {
  hostName: string;
  onHostNameChange: (v: string) => void;
  connectionMode: ConnectionMode;
  onConnectionModeChange: (v: ConnectionMode) => void;
  error: string | null;
  isSkipping: boolean;
  onNext: () => void;
  onSkip: () => void;
}

const MODE_ICONS: Record<ConnectionMode, typeof Terminal> = {
  agent: Terminal,
  cloudflare_tunnel: CloudCog,
};

/** Step 1, Screen A — host name and basic intent. */
export function StepHostBasics({
  hostName, onHostNameChange,
  connectionMode, onConnectionModeChange,
  error, isSkipping,
  onNext, onSkip,
}: Props) {
  return (
    <div className="animate-fade-in w-full">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Server className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Add your first Docker host
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Give your host a name and choose how you'll connect to it.
        </p>
      </div>

      <div className="glass-card-raised p-8 space-y-8">
        {/* Host Name */}
        <div className="space-y-2">
          <Label htmlFor="host-name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Host Name</Label>
          <Input
            id="host-name"
            placeholder="e.g. prod-server-01"
            value={hostName}
            onChange={(e) => onHostNameChange(e.target.value)}
            className="h-11 bg-background"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            A friendly name to identify this server in your dashboard.
          </p>
        </div>

        {/* Connection Method */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Connection Method</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONNECTION_MODES.map((m) => {
              const isSelected = connectionMode === m.value;
              const Icon = MODE_ICONS[m.value];
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onConnectionModeChange(m.value)}
                  className={`relative p-5 rounded-2xl border text-left transition-all group ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-[0_0_20px_-5px_rgba(14,154,184,0.15)]"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center transition-colors ${isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:text-primary/70"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className={`font-bold ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{m.label}</div>
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" size="lg" onClick={onNext} disabled={!hostName.trim()}>
          Next: Generate Installer
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>

      {/* Skip */}
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onSkip}
        disabled={isSkipping}
      >
        {isSkipping ? "Skipping..." : "Skip for now"}
      </button>

      {/* Helper info card */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The Watchtower Agent is a lightweight monitoring tool that runs alongside Docker. It communicates over a secure, authenticated channel and doesn't require exposing your Docker socket to the internet.
        </p>
      </div>
    </div>
  );
}
