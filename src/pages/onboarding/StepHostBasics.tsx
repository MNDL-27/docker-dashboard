import { Server, ArrowRight, Check, Info, Terminal, CloudCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "./ErrorBanner";
import { CONNECTION_MODES } from "./useOnboardingState";
import type { ConnectionMode } from "@/types/database";

/* ── Icon map for connection mode cards ── */
const MODE_ICONS: Record<ConnectionMode, typeof Terminal> = {
  agent: Terminal,
  cloudflare_tunnel: CloudCog,
};

interface Props {
  hostName: string;
  onHostNameChange: (v: string) => void;
  hostUrl: string;
  onHostUrlChange: (v: string) => void;
  connectionMode: ConnectionMode;
  onConnectionModeChange: (v: ConnectionMode) => void;
  error: string | null;
  isSkipping: boolean;
  onNext: () => void;
  onSkip: () => void;
}

/** Step 1, Screen A — host name, connection method, and URL. */
export function StepHostBasics({
  hostName, onHostNameChange,
  hostUrl, onHostUrlChange,
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
          Connect via the Watchtower Agent with a reverse proxy or Cloudflare Tunnel in front of it.
        </p>
      </div>

      <div className="glass-card-raised p-8 space-y-6">
        {/* Host Name */}
        <div className="space-y-2">
          <Label htmlFor="host-name" className="text-base font-medium">Host Name</Label>
          <Input
            id="host-name"
            placeholder="e.g. prod-server-01"
            value={hostName}
            onChange={(e) => onHostNameChange(e.target.value)}
            className="h-11"
            autoFocus
          />
        </div>

        {/* Connection Mode Cards */}
        <ConnectionModeSelector
          connectionMode={connectionMode}
          onConnectionModeChange={onConnectionModeChange}
        />

        {/* Agent / Tunnel URL */}
        <div className="space-y-2">
          <Label htmlFor="host-url" className="text-base font-medium">
            {connectionMode === "agent" ? "Agent URL" : "Tunnel URL"}
          </Label>
          <Input
            id="host-url"
            placeholder={connectionMode === "agent" ? "https://your-host:9876" : "https://docker.your-team.cloudflareaccess.com"}
            value={hostUrl}
            onChange={(e) => onHostUrlChange(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {connectionMode === "agent"
              ? "The HTTPS URL where the Watchtower Agent is running."
              : "The Cloudflare Tunnel public hostname. Your tunnel must route traffic to the agent on port 9876."}
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        <Button className="w-full h-11 text-base" size="lg" onClick={onNext} disabled={!hostName || !hostUrl}>
          Next
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Skip */}
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onSkip}
        disabled={isSkipping}
      >
        {isSkipping ? "Skipping..." : "Skip for now"}
      </button>

      {/* Helper info card */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {connectionMode === "cloudflare_tunnel"
            ? "The Watchtower Agent listens on port 9876. Configure your Cloudflare Tunnel to forward traffic to http://127.0.0.1:9876 on the host."
            : "The Watchtower Agent runs alongside Docker on your host. Keep it on localhost and expose it through HTTPS or Cloudflare Tunnel."}
        </p>
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
    <div className="space-y-2">
      <Label className="text-base font-medium">Connection Method</Label>
      <div className="grid grid-cols-2 gap-3">
        {CONNECTION_MODES.map((m) => {
          const isSelected = connectionMode === m.value;
          const Icon = MODE_ICONS[m.value];
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onConnectionModeChange(m.value)}
              className={`relative p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              <div className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{m.label}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-snug">{m.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
