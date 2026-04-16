import { ShieldCheck, ArrowRight, ArrowLeft, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "./ErrorBanner";
import { CopyBlock } from "./CopyBlock";
import { buildWatchtowerAgentInstallCommand } from "@/lib/agent-release";
import type { ConnectionMode } from "@/types/database";

interface Props {
  connectionMode: ConnectionMode;
  agentApiKey: string;
  onAgentApiKeyChange: (v: string) => void;
  socketPath: string;
  onSocketPathChange: (v: string) => void;
  cfServiceTokenId: string;
  onCfServiceTokenIdChange: (v: string) => void;
  cfServiceTokenSecret: string;
  onCfServiceTokenSecretChange: (v: string) => void;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

/** Step 1, Screen B — credentials, install snippet, and save & test. */
export function StepHostCredentials({
  connectionMode,
  agentApiKey, onAgentApiKeyChange,
  socketPath, onSocketPathChange,
  cfServiceTokenId, onCfServiceTokenIdChange,
  cfServiceTokenSecret, onCfServiceTokenSecretChange,
  error,
  onBack, onSubmit,
}: Props) {
  const quickInstallCommand = buildWatchtowerAgentInstallCommand();

  return (
    <div className="animate-fade-in w-full">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Connect &amp; verify
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Enter your agent credentials and we'll test the connection.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
        {/* Agent API Key */}
        <div className="space-y-2">
          <Label htmlFor="agent-key" className="text-base font-medium">Agent API Key</Label>
          <Input
            id="agent-key"
            type="password"
            placeholder="Shared secret for authenticating with the agent"
            value={agentApiKey}
            onChange={(e) => onAgentApiKeyChange(e.target.value)}
            className="h-11"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Stored securely and <strong>never returned to the browser</strong> after saving.
          </p>
        </div>

        {/* Docker Socket Path */}
        <div className="space-y-2">
          <Label htmlFor="socket-path" className="text-base font-medium">Docker Socket Path <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="socket-path"
            placeholder="/var/run/docker.sock"
            value={socketPath}
            onChange={(e) => onSocketPathChange(e.target.value)}
            className="h-11"
          />
        </div>

        {/* CF Tunnel fields */}
        {connectionMode === "cloudflare_tunnel" && (
          <CloudflareTunnelFields
            cfServiceTokenId={cfServiceTokenId}
            onCfServiceTokenIdChange={onCfServiceTokenIdChange}
            cfServiceTokenSecret={cfServiceTokenSecret}
            onCfServiceTokenSecretChange={onCfServiceTokenSecretChange}
          />
        )}

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Install snippet */}
        <AgentInstallSnippet installCommand={quickInstallCommand} />

        {error && <ErrorBanner message={error} />}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="h-11" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button className="flex-1 h-11 text-base" size="lg" onClick={onSubmit} disabled={!agentApiKey.trim()}>
            Save &amp; Test Connection
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Cloudflare Tunnel credential fields ── */
function CloudflareTunnelFields({
  cfServiceTokenId, onCfServiceTokenIdChange,
  cfServiceTokenSecret, onCfServiceTokenSecretChange,
}: {
  cfServiceTokenId: string;
  onCfServiceTokenIdChange: (v: string) => void;
  cfServiceTokenSecret: string;
  onCfServiceTokenSecretChange: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>CF Access Service Token ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          placeholder="Only if CF Access is protecting the tunnel"
          value={cfServiceTokenId}
          onChange={(e) => onCfServiceTokenIdChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>CF Access Service Token Secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          type="password"
          placeholder="e.g. xyz789..."
          value={cfServiceTokenSecret}
          onChange={(e) => onCfServiceTokenSecretChange(e.target.value)}
        />
      </div>
    </>
  );
}

/* ── Agent install snippet section ── */
function AgentInstallSnippet({ installCommand }: { installCommand: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Terminal className="h-4 w-4 text-primary" />
        Quick agent install
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        If you have not installed the agent yet, run this once on your Linux Docker host. The installer will prompt
        for the API key and register the service with systemd.
      </p>
      <CopyBlock label="One-time Linux installer" code={installCommand} />
      <p className="text-[10px] text-muted-foreground">
        The installer prompts for the same API key you enter here. Default bind and port:
        <code className="bg-muted px-1 rounded ml-1">127.0.0.1:9876</code>.
      </p>
    </div>
  );
}
