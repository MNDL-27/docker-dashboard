import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Loader2, CheckCircle2, XCircle } from "lucide-react";
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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState("");
  const addHost = useAddDockerHost();
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      new URL(hostUrl);
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid Docker API URL (e.g. http://host:2375)", variant: "destructive" });
      return;
    }

    try {
      const host = await addHost.mutateAsync({ orgId, name, hostUrl });
      // Test connection after saving
      setTestStatus('testing');
      try {
        const result = await dockerApi.ping(host.id);
        if (result.ok) {
          setTestStatus('success');
          toast({ title: "Host connected!", description: `${name} is responding. Docker ${result.docker_version || 'detected'}.` });
        } else {
          setTestStatus('error');
          setTestError('Docker API did not respond with OK');
          toast({ title: "Host saved but unreachable", description: "Check the URL and ensure Docker API is exposed on TCP.", variant: "destructive" });
        }
      } catch (e: any) {
        setTestStatus('error');
        setTestError(e.message);
        toast({ title: "Host saved but connection failed", description: e.message, variant: "destructive" });
      }
      setTimeout(() => {
        setOpen(false);
        setName("");
        setHostUrl("");
        setTestStatus('idle');
        setTestError("");
      }, 1500);
    } catch (error: any) {
      toast({ title: "Failed to add host", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTestStatus('idle'); setTestError(""); } }}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Connect Host</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Docker Host</DialogTitle>
          <DialogDescription>
            Add a Docker host by providing its remote API URL. The Docker daemon must be configured to listen on a TCP port.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Host Name</Label>
            <Input placeholder="e.g. prod-server-01" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Docker API URL</Label>
            <Input placeholder="http://your-server:2375" value={hostUrl} onChange={e => setHostUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              The Docker daemon must be configured with <code className="bg-muted px-1 py-0.5 rounded">-H tcp://0.0.0.0:2375</code> to accept remote connections.
            </p>
          </div>
          {testStatus === 'error' && testError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{testError}</p>
            </div>
          )}
          {testStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 border border-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-xs text-success">Connection successful!</p>
            </div>
          )}
          <Button onClick={handleSave} disabled={!name || !hostUrl || addHost.isPending || testStatus === 'testing'} className="w-full">
            {addHost.isPending || testStatus === 'testing' ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting...</>
            ) : "Save & Test Connection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
