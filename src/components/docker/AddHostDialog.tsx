import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle2, XCircle, ShieldCheck, CloudCog, Terminal } from "lucide-react";
import { useAddDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";
import type { ConnectionMode } from "@/types/database";

interface AddHostDialogProps {
  orgId: string;
  trigger?: React.ReactNode;
}

export function AddHostDialog({ orgId, trigger }: AddHostDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ConnectionMode>("agent");
  const [hostUrl, setHostUrl] = useState("");
  const [socketPath, setSocketPath] = useState("/var/run/docker.sock");
  // Agent mode
  const [agentApiKey, setAgentApiKey] = useState("");
  // Cloudflare Tunnel mode
  const [cfServiceTokenId, setCfServiceTokenId] = useState("");
  const [cfServiceTokenSecret, setCfServiceTokenSecret] = useState("");

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState("");
  const addHost = useAddDockerHost();
  const { toast } = useToast();

  const resetForm = () => {
    setName(""); setHostUrl(""); setMode("agent"); setSocketPath("/var/run/docker.sock");
    setAgentApiKey(""); setCfServiceTokenId(""); setCfServiceTokenSecret("");
    setTestStatus('idle'); setTestError("");
  };

  const handleSave = async () => {
    try { new URL(hostUrl); } catch {
      toast({ title: "Invalid URL", description: "Enter a valid agent or tunnel URL (e.g. https://agent.example.com:9876)", variant: "destructive" });
      return;
    }

    if (mode === 'agent' && !agentApiKey.trim()) {
      toast({ title: "API Key required", description: "Enter the agent API key for authentication.", variant: "destructive" });
      return;
    }

    if (mode === 'cloudflare_tunnel' && (!cfServiceTokenId.trim() || !cfServiceTokenSecret.trim())) {
      toast({ title: "CF Access tokens required", description: "Enter both Cloudflare Access Service Token ID and Secret.", variant: "destructive" });
      return;
    }

    try {
      const host = await addHost.mutateAsync({
        orgId, name, hostUrl,
        connectionMode: mode,
        dockerSocketPath: socketPath,
        secrets: mode === 'agent'
          ? { agentApiKey: agentApiKey.trim() }
          : { cfServiceTokenId: cfServiceTokenId.trim(), cfServiceTokenSecret: cfServiceTokenSecret.trim() },
      });

      setTestStatus('testing');
      try {
        const result = await dockerApi.ping(host.id);
        if (result.ok) {
          setTestStatus('success');
          toast({ title: "Host connected!", description: `${name} is responding. Docker ${result.docker_version || 'detected'}.` });
        } else {
          setTestStatus('error');
          setTestError('Docker API did not respond with OK');
          toast({ title: "Host saved but unreachable", description: "Check URL and credentials.", variant: "destructive" });
        }
      } catch (e: any) {
        setTestStatus('error');
        setTestError(e.message);
        toast({ title: "Host saved but connection failed", description: e.message, variant: "destructive" });
      }

      setTimeout(() => { setOpen(false); resetForm(); }, 1500);
    } catch (error: any) {
      toast({ title: "Failed to add host", description: error.message, variant: "destructive" });
    }
  };

  const modes: { value: ConnectionMode; label: string; icon: typeof Terminal; desc: string }[] = [
    { value: 'agent', label: 'Watchtower Agent', icon: Terminal, desc: 'Install a lightweight agent on the host. No open Docker ports needed.' },
    { value: 'cloudflare_tunnel', label: 'Cloudflare Tunnel', icon: CloudCog, desc: 'Use Cloudflare Tunnel to expose Docker socket securely. Zero open ports.' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Connect Host</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Connect Docker Host
          </DialogTitle>
          <DialogDescription>
            Connect securely via a lightweight agent or Cloudflare Tunnel. No open Docker ports required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Connection Mode Selector */}
          <div className="space-y-2">
            <Label>Connection Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {modes.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    mode === m.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <m.icon className={`h-4 w-4 mb-1 ${mode === m.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-xs font-medium">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Host Name</Label>
            <Input placeholder="e.g. prod-server-01" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{mode === 'agent' ? 'Agent URL' : 'Tunnel URL'}</Label>
            <Input
              placeholder={mode === 'agent' ? 'https://your-host:9876' : 'https://docker.your-team.cloudflareaccess.com'}
              value={hostUrl}
              onChange={e => setHostUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {mode === 'agent'
                ? 'The HTTPS URL where the Watchtower Agent is running.'
                : 'The Cloudflare Tunnel public hostname that proxies the Docker socket.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Docker Socket Path <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="/var/run/docker.sock" value={socketPath} onChange={e => setSocketPath(e.target.value)} />
          </div>

          {/* Agent-specific fields */}
          {mode === 'agent' && (
            <div className="space-y-2">
              <Label>Agent API Key</Label>
              <Input
                type="password"
                placeholder="Shared secret for authenticating with the agent"
                value={agentApiKey}
                onChange={e => setAgentApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This key is stored securely and <strong>never returned to the browser</strong> after saving.
              </p>
            </div>
          )}

          {/* Cloudflare Tunnel fields */}
          {mode === 'cloudflare_tunnel' && (
            <>
              <div className="space-y-2">
                <Label>CF Access Service Token ID</Label>
                <Input
                  placeholder="e.g. abc123..."
                  value={cfServiceTokenId}
                  onChange={e => setCfServiceTokenId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CF Access Service Token Secret</Label>
                <Input
                  type="password"
                  placeholder="e.g. xyz789..."
                  value={cfServiceTokenSecret}
                  onChange={e => setCfServiceTokenSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tokens are stored securely and <strong>never returned to the browser</strong> after saving.
                </p>
              </div>
            </>
          )}

          {testStatus === 'error' && testError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{testError}</p>
            </div>
          )}
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-xs text-primary">Connection successful!</p>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!name || !hostUrl || addHost.isPending || testStatus === 'testing'}
            className="w-full"
          >
            {addHost.isPending || testStatus === 'testing' ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting...</>
            ) : "Save & Test Connection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
