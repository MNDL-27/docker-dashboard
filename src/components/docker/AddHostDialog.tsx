import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAddDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";

interface AddHostDialogProps {
  orgId: string;
  trigger?: React.ReactNode;
}

export function AddHostDialog({ orgId, trigger }: AddHostDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [caCert, setCaCert] = useState("");
  const [clientCert, setClientCert] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [serverName, setServerName] = useState("");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState("");
  const addHost = useAddDockerHost();
  const { toast } = useToast();

  const isInsecure = (() => {
    try {
      const u = new URL(hostUrl);
      return u.protocol === 'http:' || u.port === '2375';
    } catch { return false; }
  })();

  const hasTlsCerts = !!(caCert.trim() && clientCert.trim() && clientKey.trim());

  const resetForm = () => {
    setName(""); setHostUrl(""); setCaCert(""); setClientCert("");
    setClientKey(""); setServerName(""); setTestStatus('idle'); setTestError("");
  };

  const handleSave = async () => {
    try { new URL(hostUrl); } catch {
      toast({ title: "Invalid URL", description: "Enter a valid Docker API URL (e.g. https://docker.example.com:2376)", variant: "destructive" });
      return;
    }

    if (isInsecure && !window.confirm(
      "WARNING: You are connecting over plain HTTP without TLS. " +
      "This is insecure and should only be used for local development. Continue?"
    )) return;

    if (!isInsecure && !hasTlsCerts) {
      toast({ title: "TLS certificates required", description: "HTTPS hosts require CA cert, client cert, and client key for mutual TLS.", variant: "destructive" });
      return;
    }

    try {
      const host = await addHost.mutateAsync({
        orgId, name, hostUrl,
        tlsCerts: hasTlsCerts ? {
          caCert: caCert.trim(),
          clientCert: clientCert.trim(),
          clientKey: clientKey.trim(),
          serverName: serverName.trim() || undefined,
        } : undefined,
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
          toast({ title: "Host saved but unreachable", description: "Check URL and TLS configuration.", variant: "destructive" });
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

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Connect Host</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Connect Docker Host (TLS)
          </DialogTitle>
          <DialogDescription>
            Connect to a Docker daemon over its remote TLS API (port 2376). Mutual TLS certificates are required for secure connections.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Host Name</Label>
            <Input placeholder="e.g. prod-server-01" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Docker API URL</Label>
            <Input placeholder="https://docker.example.com:2376" value={hostUrl} onChange={e => setHostUrl(e.target.value)} />
            {isInsecure && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">Insecure connection (plain HTTP or port 2375). Use only for local development.</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Docker daemon must be configured with <code className="bg-muted px-1 py-0.5 rounded">--tlsverify</code> and listening on TCP port 2376.
            </p>
          </div>

          {!isInsecure && (
            <>
              <div className="space-y-2">
                <Label>CA Certificate (ca.pem)</Label>
                <Textarea
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={caCert}
                  onChange={e => setCaCert(e.target.value)}
                  className="font-mono text-xs h-24"
                />
              </div>

              <div className="space-y-2">
                <Label>Client Certificate (cert.pem)</Label>
                <Textarea
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={clientCert}
                  onChange={e => setClientCert(e.target.value)}
                  className="font-mono text-xs h-24"
                />
              </div>

              <div className="space-y-2">
                <Label>Client Key (key.pem)</Label>
                <Textarea
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={clientKey}
                  onChange={e => setClientKey(e.target.value)}
                  className="font-mono text-xs h-24"
                />
                <p className="text-xs text-muted-foreground">
                  Private key is stored securely and <strong>never returned to the browser</strong> after saving.
                </p>
              </div>

              <div className="space-y-2">
                <Label>TLS Server Name <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="docker.example.com" value={serverName} onChange={e => setServerName(e.target.value)} />
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
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-emerald-500">Connection successful!</p>
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
