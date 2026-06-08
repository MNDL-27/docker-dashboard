import { cloneElement, isValidElement, useEffect, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, CheckCircle2, XCircle, ShieldCheck, CloudCog, Terminal, Pencil, Eye, EyeOff, Copy, RefreshCw, Wrench, Info, Check, ArrowRight } from "lucide-react";
import { useAddDockerHost, useUpdateDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { agentEnrollmentApi, type AgentEnrollmentCreateResponse } from "@/services/agent-enrollment";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { ConnectionMode, DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION, isAgentVersionOutdated } from "@/lib/agent-version";
import { sanitizeConnectionError } from "@/lib/error-sanitizer";
import { COPY_FEEDBACK_DURATION_MS } from "@/lib/constants";
import { CONNECTION_MODES } from "@/pages/onboarding/useOnboardingState";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";

interface AddHostDialogProps {
  orgId: string;
  trigger?: React.ReactNode;
  host?: DockerHost | null;
  /**
   * When set, the trigger renders disabled and shows this string in a tooltip.
   * Used to gate "Add host" when the org has reached its plan node limit.
   */
  disabledReason?: string;
}

interface EditableHostSecrets {
  agentApiKey: string;
  cfServiceTokenId: string;
  cfServiceTokenSecret: string;
}

type GuidedStage = "basics" | "install" | "finalizing";

const MODE_ICONS: Record<ConnectionMode, typeof Terminal> = {
  agent: Terminal,
  http: Terminal,
  cloudflare_tunnel: CloudCog,
};

function CommandBlock({
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
    window.setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2">
          {masked ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px]" onClick={() => setRevealed((value) => !value)}>
              {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {revealed ? "Hide" : "Reveal"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px]" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-background/50 p-3 font-mono text-[11px] leading-relaxed">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{visibleCommand}</pre>
      </div>
    </div>
  );
}

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

export function AddHostDialog({ orgId, trigger, host, disabledReason }: AddHostDialogProps) {
  const isEditing = !!host;
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<GuidedStage>("basics");
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enrollment, setEnrollment] = useState<AgentEnrollmentCreateResponse | null>(null);
  const [guidedError, setGuidedError] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [remediationCommand, setRemediationCommand] = useState<string | null>(null);
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
    setShowAdvanced(false);
    setEnrollment(null);
    setGuidedError("");
    setStage("basics");
    setTestStatus("idle");
    setTestError("");
    setTestMessage("");
    setRemediationCommand(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .catch((error: unknown) => {
        if (!active) return;
        const sanitized = sanitizeConnectionError(error);
        toast({
          title: "Failed to load host secrets",
          description: sanitized.description,
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

  const handleSaveEdit = async () => {
    if (!hostUrl.trim()) {
      toast({ title: "Invalid Host", description: "Enter a valid agent IP or hostname.", variant: "destructive" });
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
          ...(mode === "cloudflare_tunnel" && {
            cfServiceTokenId: cfServiceTokenId.trim() || undefined,
            cfServiceTokenSecret: cfServiceTokenSecret.trim() || undefined,
          }),
        },
      };

      const savedHost = await updateHost.mutateAsync({
        hostId: host!.id,
        ...payload,
      });

      setTestStatus("testing");
      try {
        const result = await dockerApi.ping(savedHost.id);
        if (result.ok) {
          setTestStatus("success");
          setTestMessage(result.agent_version_error || "");
          const agentVersion = result.agent_version || null;
          const latestVersion = result.latest_agent_version || CURRENT_WATCHTOWER_AGENT_VERSION;
          const agentOutdated = isAgentVersionOutdated(agentVersion);
          toast({
            title: "Host updated!",
            description: [
              `Docker ${result.docker_version || "detected"}.`,
              agentVersion
                ? `Agent ${agentVersion}${agentOutdated ? ` is behind ${latestVersion}` : ""}.`
                : result.agent_version_error
                  ? `Agent version not reported yet (${result.agent_version_error}). Current release is ${latestVersion}.`
                  : `Agent version not reported yet. Current release is ${latestVersion}.`,
            ].join(" "),
          });
        } else {
          setTestStatus("error");
          setTestError("Docker API did not respond with OK");
          toast({ title: "Host updated but unreachable", description: "Check URL and credentials.", variant: "destructive" });
        }
      } catch (e) {
        setTestStatus("error");
        const sanitized = sanitizeConnectionError(e);
        setTestError(sanitized.description);
        toast({ title: sanitized.title, description: sanitized.description, variant: "destructive" });
      }

      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, COPY_FEEDBACK_DURATION_MS);
    } catch (error) {
      const sanitized = sanitizeConnectionError(error);
      toast({ title: "Failed to update host", description: sanitized.description, variant: "destructive" });
    }
  };

  const handleStartGuidedSetup = async () => {
    setGuidedError("");
    if (!name.trim()) {
      setGuidedError("Host name is required.");
      return;
    }

    try {
      setStage("finalizing");
      const response = await agentEnrollmentApi.create({
        organizationId: orgId,
        hostName: name,
        connectionMode: mode,
        dockerSocketPath: socketPath,
        cfServiceTokenId: mode === "cloudflare_tunnel" ? cfServiceTokenId.trim() || undefined : undefined,
        cfServiceTokenSecret: mode === "cloudflare_tunnel" ? cfServiceTokenSecret.trim() || undefined : undefined,
      });
      setEnrollment(response);
      setGuidedError("");
      setStage("install");
    } catch (error) {
      const sanitized = sanitizeConnectionError(error);
      setGuidedError(sanitized.description || "Failed to prepare the guided setup command.");
      setStage("basics");
    }
  };

  const handleFinalizeGuidedSetup = async () => {
    if (!enrollment?.session_id) return;

    if (!hostUrl.trim()) {
      setGuidedError("Host URL is required to test the connection.");
      return;
    }

    if (!hostUrl.trim()) {
      setGuidedError("Enter a valid IP or hostname (e.g. 192.168.1.5)");
      return;
    }

    setGuidedError("");
    setTestError("");
    setRemediationCommand(null);
    setStage("finalizing");

    try {
      const result = await agentEnrollmentApi.finalize(enrollment.session_id, hostUrl);
      if (result.ok) {
        setTestStatus("success");
        setTestMessage(
          result.reason_code === "agent_outdated"
            ? "Host connected, but the installed agent is behind the current release."
            : result.reason_code === "metrics_unavailable"
              ? "Host connected, but local metrics verification still needs attention."
              : "Connection verified successfully."
        );
        toast({
          title: "Host connected!",
          description: result.reason_code
            ? "The host is reachable. Review the follow-up guidance if shown."
            : "The host was installed and verified through Dockerdash.",
        });
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, COPY_FEEDBACK_DURATION_MS);
      } else {
        setTestStatus("error");
        setTestError(result.status || "Connection test failed.");
        setRemediationCommand(result.remediation_command);
        setStage("install");
      }
    } catch (error) {
      setTestStatus("error");
      const sanitized = sanitizeConnectionError(error);
      setTestError(sanitized.description || "Connection test failed.");
      setStage("install");
    }
  };

  const isBusy = addHost.isPending || updateHost.isPending || loadingSecrets || stage === "finalizing";

  const defaultTrigger = (
    <Button size="sm" className="gap-1.5">
      {isEditing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {isEditing ? "Edit Host" : "Connect Host"}
    </Button>
  );

  // Gate when org is at plan limit.
  if (disabledReason && !isEditing) {
    const enabledTrigger = trigger ?? defaultTrigger;
    const disabledTrigger = isValidElement(enabledTrigger)
      ? cloneElement(enabledTrigger as ReactElement<{ className?: string; disabled?: boolean }>, {
          disabled: true,
          className: `${(enabledTrigger as ReactElement<{ className?: string }>).props.className ?? ""} pointer-events-none opacity-60`.trim(),
        })
      : enabledTrigger;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex" aria-disabled="true">
            {disabledTrigger}
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/30 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {isEditing ? "Edit Docker Host" : "Connect Docker Host"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEditing
              ? "Update the saved host connection, endpoint, and credentials."
              : "Follow the guided setup to connect a new server to your fleet."}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <div className="p-6 space-y-5">
            <ConnectionModeSelector
              connectionMode={mode}
              onConnectionModeChange={setMode}
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Host Name</Label>
              <Input placeholder="e.g. prod-server-01" value={name} onChange={(e) => setName(e.target.value)} className="h-10 bg-background" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{mode === "cloudflare_tunnel" ? "Tunnel Hostname" : mode === "http" ? "HTTP Agent Hostname/IP" : "Agent Hostname/IP"}</Label>
              <Input
                placeholder={mode === "cloudflare_tunnel" ? "docker.your-team.cloudflareaccess.com" : "192.168.1.5"}
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                className="h-10 bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Docker Socket Path <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="/var/run/docker.sock" value={socketPath} onChange={(e) => setSocketPath(e.target.value)} className="h-10 bg-background" />
            </div>

            {mode === "cloudflare_tunnel" ? (
              <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">CF Access Service Token ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    placeholder="Only if CF Access is protecting the tunnel"
                    value={cfServiceTokenId}
                    onChange={(e) => setCfServiceTokenId(e.target.value)}
                    className="h-9 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">CF Access Service Token Secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Input
                      type={showCfSecret ? "text" : "password"}
                      placeholder="Only if CF Access is protecting the tunnel"
                      value={cfServiceTokenSecret}
                      onChange={(e) => setCfServiceTokenSecret(e.target.value)}
                      className="pr-10 h-9 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCfSecret((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showCfSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Agent API Key</Label>
              <div className="relative">
                <Input
                  type={showAgentKey ? "text" : "password"}
                  placeholder="Shared secret for authenticating with the agent"
                  value={agentApiKey}
                  onChange={(e) => setAgentApiKey(e.target.value)}
                  disabled={loadingSecrets}
                  className="pr-10 h-10 bg-background"
                />
                <button
                  type="button"
                  onClick={() => setShowAgentKey((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showAgentKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {testStatus === "error" && testError ? (
              testError.includes("non-Docker hosts") ? (
                <PremiumFeatureBlock
                  title="Docker Not Installed"
                  description="This host does not have Docker installed. Upgrade to the Team or Enterprise plan to monitor pure Linux machines."
                  hasAccess={false}
                  className="p-6 mt-2 border border-border shadow-sm"
                />
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{testError}</p>
                </div>
              )
            ) : null}

            {testStatus === "success" ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-xs text-primary">Connection successful!</p>
                  {testMessage ? <p className="text-[11px] text-muted-foreground">{testMessage}</p> : null}
                </div>
              </div>
            ) : null}

            <Button 
              onClick={handleSaveEdit} 
              disabled={!name || !hostUrl || isBusy || !agentApiKey.trim()} 
              className="w-full h-11 font-bold shadow-lg shadow-primary/10 mt-2"
            >
              {isBusy || testStatus === "testing" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes & Test Connection"}
            </Button>
          </div>
        ) : stage === "finalizing" && !enrollment ? (
          <div className="p-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div className="space-y-1">
              <p className="font-bold">Preparing guided setup...</p>
              <p className="text-sm text-muted-foreground">Creating a one-time enrollment for "{name}"</p>
            </div>
          </div>
        ) : stage === "install" && enrollment ? (
          <div className="p-6 space-y-8">
             {/* Step 1: Install */}
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">1</div>
                <h3 className="font-bold text-lg">Install the Agent</h3>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run this one-liner on your Docker host to install the agent service.
              </p>

              <CommandBlock label="Run this command" command={enrollment.install_command} />

              <Accordion type="single" collapsible className="w-full border rounded-xl overflow-hidden bg-muted/20">
                <AccordionItem value="verify" className="border-none">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 font-semibold">
                      <Wrench className="h-3.5 w-3.5" />
                      Optional: Verify locally
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <p className="text-[11px] text-muted-foreground">Confirm the agent is listening locally before continuing:</p>
                    <CommandBlock label="Local verify command" command={enrollment.verify_command} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="h-px bg-border/50" />

            {/* Step 2: Configure Access */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">2</div>
                <h3 className="font-bold text-lg">Configure Access</h3>
              </div>

              <div className="space-y-3 pt-1">
                <Label htmlFor="host-url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {mode === "cloudflare_tunnel" ? "Tunnel Hostname" : mode === "http" ? "Public HTTP Agent Hostname/IP" : "Public Agent Hostname/IP"}
                </Label>
                <Input
                  id="host-url"
                  placeholder={mode === "cloudflare_tunnel" ? "docker.your-team.cloudflareaccess.com" : "agent.example.com"}
                  value={hostUrl}
                  onChange={(e) => setHostUrl(e.target.value)}
                  className="h-11 bg-background"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {mode === "cloudflare_tunnel"
                    ? "The Cloudflare Tunnel hostname routing to port 9876."
                    : mode === "http"
                      ? "The external IP or hostname of your agent. Ensure port 9876 is accessible."
                      : "The external IP or hostname of your agent. Ensure port 9876 is accessible."}
                </p>
              </div>
            </div>

            {guidedError ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{guidedError}</p>
              </div>
            ) : null}

            {testStatus === "error" && testError ? (
              testError.includes("non-Docker hosts") ? (
                <PremiumFeatureBlock
                  title="Docker Not Installed"
                  description="This host does not have Docker installed. Upgrade to the Team or Enterprise plan to monitor pure Linux machines."
                  hasAccess={false}
                  className="p-6 mt-2 border border-border shadow-sm"
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{testError}</p>
                  </div>
                  {remediationCommand ? <CommandBlock label="Suggested remediation command" command={remediationCommand} /> : null}
                </div>
              )
            ) : null}

            {testStatus === "success" ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-xs text-primary">Connection successful!</p>
                  {testMessage ? <p className="text-[11px] text-muted-foreground">{testMessage}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="flex gap-4 pt-2 pb-2">
              <Button variant="outline" onClick={() => setStage("basics")} className="h-12 px-6 gap-2 border-border/60">
                <RefreshCw className="h-4 w-4" />
                Start Over
              </Button>
              <Button 
                onClick={handleFinalizeGuidedSetup} 
                className="flex-1 font-bold shadow-lg shadow-primary/20 h-12 text-base"
                disabled={!hostUrl.trim() || isBusy}
              >
                {isBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</> : "Finish & Verify Connection"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Host Name</Label>
              <Input 
                placeholder="e.g. prod-server-01" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="h-11 bg-background"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                A friendly name to identify this server in your dashboard.
              </p>
            </div>

            <ConnectionModeSelector
              connectionMode={mode}
              onConnectionModeChange={setMode}
            />

            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Docker Socket Path <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="/var/run/docker.sock" value={socketPath} onChange={(e) => setSocketPath(e.target.value)} className="h-10 bg-background" />
            </div>

            {guidedError ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{guidedError}</p>
              </div>
            ) : null}

            <Button onClick={handleStartGuidedSetup} disabled={!name.trim() || isBusy} className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20">
              {isBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing...</> : "Next: Generate Installer"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <div className="mt-2 flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The Watchtower Agent is a lightweight monitoring tool that runs alongside Docker. It communicates over a secure, authenticated channel and doesn't require exposing your Docker socket to the internet.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
