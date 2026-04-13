import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle2, XCircle, ShieldCheck, CloudCog, Terminal, Pencil, Eye, EyeOff } from "lucide-react";
import { useAddDockerHost, useUpdateDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { ConnectionMode, DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION, isAgentVersionOutdated } from "@/lib/agent-version";

interface AddHostDialogProps {
  orgId: string;
  trigger?: React.ReactNode;
  host?: DockerHost | null;
}

interface EditableHostSecrets {
  agentApiKey: string;
  cfServiceTokenId: string;
  cfServiceTokenSecret: string;
}

export function AddHostDialog({ orgId, trigger, host }: AddHostDialogProps) {
  const isEditing = !!host;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ConnectionMode>("agent");
  const [hostUrl, setHostUrl] = useState("");
  const [socketPath, setSocketPath] = useState("/var/run/docker.sock");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [cfServiceTokenId, setCfServiceTokenId] = useState("");
  const [cfServiceTokenSecret, setCfServiceTokenSecret] = useState("");
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [showAgentKey, setShowAgentKey] = useState(false);
  const [showCfSecret, setShowCfSecret] = useState(false);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const addHost = useAddDockerHost();
  const updateHost = useUpdateDockerHost();
  const { toast } = useToast();

  const resetForm = () => {
    setName(host?.name ?? "");
    setHostUrl(host?.host_url ?? "");
    setMode(host?.connection_mode ?? "agent");
    setSocketPath(host?.docker_socket_path ?? "/var/run/docker.sock");
    setAgentApiKey("");
    setCfServiceTokenId("");
    setCfServiceTokenSecret("");
    setLoadingSecrets(false);
    setShowAgentKey(false);
    setShowCfSecret(false);
    setTestStatus('idle'); setTestError(""); setTestMessage("");
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, host]);

  useEffect(() => {
    if (!open || !host) return;

    let active = true;
    setLoadingSecrets(true);
    apiFetch(`/docker-hosts?hostId=${host.id}&includeSecrets=true`)
      .then((data) => {
        if (!active) return;
        const secrets = (data as { secrets?: EditableHostSecrets }).secrets;
        setAgentApiKey(secrets?.agentApiKey ?? "");
        setCfServiceTokenId(secrets?.cfServiceTokenId ?? "");
        setCfServiceTokenSecret(secrets?.cfServiceTokenSecret ?? "");
      })
      .catch((error: any) => {
        if (!active) return;
        toast({
          title: "Failed to load host secrets",
          description: error.message,
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoadingSecrets(false);
      });

    return () => {
      active = false;
    };
  }, [open, host, toast]);

  const handleSave = async () => {
    try { new URL(hostUrl); } catch {
      toast({ title: "Invalid URL", description: "Enter a valid agent or tunnel URL (e.g. https://agent.example.com:9876)", variant: "destructive" });
      return;
    }

    if (!agentApiKey.trim()) {
      toast({ title: "API Key required", description: "The agent API key is required for both connection modes.", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        name,
        hostUrl,
        connectionMode: mode,
        dockerSocketPath: socketPath,
        secrets: {
          agentApiKey: agentApiKey.trim(),
          ...(mode === 'cloudflare_tunnel' && {
            cfServiceTokenId: cfServiceTokenId.trim() || undefined,
            cfServiceTokenSecret: cfServiceTokenSecret.trim() || undefined,
          }),
        },
      };
      const savedHost = isEditing && host
        ? await updateHost.mutateAsync({
            hostId: host.id,
            ...payload,
          })
        : await addHost.mutateAsync({
            orgId,
            ...payload,
          });

      setTestStatus('testing');
      try {
        const result = await dockerApi.ping(savedHost.id);
        if (result.ok) {
          setTestStatus('success');
          setTestMessage(result.agent_version_error || "");
          const agentVersion = result.agent_version || null;
          const latestVersion = result.latest_agent_version || CURRENT_WATCHTOWER_AGENT_VERSION;
          const agentOutdated = isAgentVersionOutdated(agentVersion);
          toast({
            title: isEditing ? "Host updated!" : "Host connected!",
            description: [
              `Docker ${result.docker_version || 'detected'}.`,
              agentVersion
                ? `Agent ${agentVersion}${agentOutdated ? ` is behind ${latestVersion}` : ''}.`
                : result.agent_version_error
                  ? `Agent version not reported yet (${result.agent_version_error}). Current release is ${latestVersion}.`
                  : `Agent version not reported yet. Current release is ${latestVersion}.`,
            ].join(' '),
          });
        } else {
          setTestStatus('error');
          setTestError('Docker API did not respond with OK');
          setTestMessage('');
          toast({ title: isEditing ? "Host updated but unreachable" : "Host saved but unreachable", description: "Check URL and credentials.", variant: "destructive" });
        }
      } catch (e: any) {
        setTestStatus('error');
        setTestError(e.message);
        setTestMessage('');
        toast({ title: isEditing ? "Host updated but connection failed" : "Host saved but connection failed", description: e.message, variant: "destructive" });
      }

      setTimeout(() => { setOpen(false); resetForm(); }, 1500);
    } catch (error: any) {
      toast({ title: isEditing ? "Failed to update host" : "Failed to add host", description: error.message, variant: "destructive" });
    }
  };

  const modes: { value: ConnectionMode; label: string; icon: typeof Terminal; desc: string }[] = [
    { value: 'agent', label: 'Agent (Direct)', icon: Terminal, desc: 'Connect to the Watchtower Agent over HTTPS. Agent runs on the host and proxies to Docker socket.' },
    { value: 'cloudflare_tunnel', label: 'Agent via CF Tunnel', icon: CloudCog, desc: 'Same agent, accessed through a Cloudflare Tunnel. Zero open ports on the host.' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5">
            {isEditing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isEditing ? "Edit Host" : "Connect Host"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Docker Host" : "Connect Docker Host"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the saved host connection, endpoint, and credentials."
              : "Connect securely via a lightweight agent or Cloudflare Tunnel. No open Docker ports required."}
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

          {/* Agent API Key - required for both modes */}
          <div className="space-y-2">
            <Label>Agent API Key</Label>
            <div className="relative">
              <Input
                type={showAgentKey ? "text" : "password"}
                placeholder="Shared secret for authenticating with the agent"
                value={agentApiKey}
                onChange={e => setAgentApiKey(e.target.value)}
                disabled={loadingSecrets}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAgentKey((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showAgentKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "The saved API key is loaded here so you can review or replace it."
                : "This key is stored securely for the host connection."}
            </p>
          </div>

          {/* Cloudflare Tunnel - additional CF Access headers */}
          {mode === 'cloudflare_tunnel' && (
            <>
              <div className="space-y-2">
                <Label>CF Access Service Token ID <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  placeholder="Only if CF Access is protecting the tunnel"
                  value={cfServiceTokenId}
                  onChange={e => setCfServiceTokenId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CF Access Service Token Secret <span className="text-muted-foreground">(optional)</span></Label>
                <div className="relative">
                  <Input
                    type={showCfSecret ? "text" : "password"}
                    placeholder="e.g. xyz789..."
                    value={cfServiceTokenSecret}
                    onChange={e => setCfServiceTokenSecret(e.target.value)}
                    disabled={loadingSecrets}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCfSecret((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showCfSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only needed if Cloudflare Access protects your tunnel endpoint.
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
              <div className="space-y-0.5">
                <p className="text-xs text-primary">Connection successful!</p>
                {testMessage && <p className="text-[11px] text-muted-foreground">{testMessage}</p>}
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!name || !hostUrl || addHost.isPending || updateHost.isPending || testStatus === 'testing' || loadingSecrets}
            className="w-full"
          >
            {addHost.isPending || updateHost.isPending || testStatus === 'testing' || loadingSecrets ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting...</>
            ) : isEditing ? "Save Changes & Test Connection" : "Save & Test Connection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
