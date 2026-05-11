import { cloneElement, isValidElement, useEffect, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, CheckCircle2, XCircle, ShieldCheck, CloudCog, Terminal, Pencil, Eye, EyeOff, Copy, RefreshCw, Wrench } from "lucide-react";
import { useAddDockerHost, useUpdateDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { agentEnrollmentApi, type AgentEnrollmentCreateResponse } from "@/services/agent-enrollment";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { ConnectionMode, DockerHost } from "@/types/database";
import { CURRENT_WATCHTOWER_AGENT_VERSION, isAgentVersionOutdated } from "@/lib/agent-version";
import { sanitizeConnectionError } from "@/lib/error-sanitizer";
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

type GuidedStage = "form" | "guided" | "finalizing";

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
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
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
      <div className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{visibleCommand}</pre>
      </div>
    </div>
  );
}

export function AddHostDialog({ orgId, trigger, host, disabledReason }: AddHostDialogProps) {
  const isEditing = !!host;
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<GuidedStage>("form");
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
    setStage("form");
    setTestStatus("idle");
    setTestError("");
    setTestMessage("");
    setRemediationCommand(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    // resetForm closes over `host`; both `open` and `host` are the only inputs that should re-fire this effect.
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
    try {
      new URL(hostUrl);
    } catch {
      toast({ title: "Invalid URL", description: "Enter a valid agent or tunnel URL.", variant: "destructive" });
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
      }, 1500);
    } catch (error) {
      const sanitized = sanitizeConnectionError(error);
      toast({ title: "Failed to update host", description: sanitized.description, variant: "destructive" });
    }
  };

  const handleStartGuidedSetup = async () => {
    setGuidedError("");
    try {
      new URL(hostUrl);
    } catch {
      setGuidedError("Enter a valid URL (for example https://agent.example.com:9876).");
      return;
    }

    if (!name.trim()) {
      setGuidedError("Host name is required.");
      return;
    }

    try {
      setStage("finalizing");
      const response = await agentEnrollmentApi.create({
        organizationId: orgId,
        hostName: name,
        hostUrl,
        connectionMode: mode,
        dockerSocketPath: socketPath,
        cfServiceTokenId: mode === "cloudflare_tunnel" ? cfServiceTokenId.trim() || undefined : undefined,
        cfServiceTokenSecret: mode === "cloudflare_tunnel" ? cfServiceTokenSecret.trim() || undefined : undefined,
      });
      setEnrollment(response);
      setGuidedError("");
      setStage("guided");
    } catch (error) {
      const sanitized = sanitizeConnectionError(error);
      setGuidedError(sanitized.description || "Failed to prepare the guided setup command.");
      setStage("form");
    }
  };

  const handleFinalizeGuidedSetup = async () => {
    if (!enrollment?.session_id) return;
    setGuidedError("");
    setTestError("");
    setRemediationCommand(null);
    setStage("finalizing");

    try {
      const result = await agentEnrollmentApi.finalize(enrollment.session_id);
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
        }, 1500);
      } else {
        setTestStatus("error");
        setTestError(result.status || "Connection test failed.");
        setRemediationCommand(result.remediation_command);
        setStage("guided");
      }
    } catch (error) {
      setTestStatus("error");
      const sanitized = sanitizeConnectionError(error);
      setTestError(sanitized.description || "Connection test failed.");
      setStage("guided");
    }
  };

  const modes: { value: ConnectionMode; label: string; icon: typeof Terminal; desc: string }[] = [
    { value: "agent", label: "Agent (Direct)", icon: Terminal, desc: "Connect to the Watchtower Agent over HTTPS." },
    { value: "cloudflare_tunnel", label: "Agent via CF Tunnel", icon: CloudCog, desc: "Same agent, accessed through a Cloudflare Tunnel." },
  ];

  const isBusy = addHost.isPending || updateHost.isPending || loadingSecrets || stage === "finalizing";

  const defaultTrigger = (
    <Button size="sm" className="gap-1.5">
      {isEditing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {isEditing ? "Edit Host" : "Connect Host"}
    </Button>
  );

  // Gate when org is at plan limit. Render a disabled placeholder + tooltip so
  // users see why the action is blocked instead of getting a toast after
  // filling out the form. Editing existing hosts is never gated. Reuse the
  // caller's trigger (or defaultTrigger) so the disabled state keeps the same
  // size/label as the enabled state.
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Docker Host" : "Connect Docker Host"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the saved host connection, endpoint, and credentials."
              : "Create a guided one-command installer flow, then finish the host test through Dockerdash."}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && stage === "guided" && enrollment ? (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
              {enrollment.setup_summary}
            </div>

            <CommandBlock label="Primary install command" command={enrollment.install_command} />
            <CommandBlock label="Local verify command" command={enrollment.verify_command} />

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                <Wrench className="h-4 w-4 text-primary" />
                {showAdvanced ? "Hide manual fallback" : "Use manual install instead"}
              </button>
              {showAdvanced ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    This advanced command embeds the long-lived API key. Use it only if you want to skip the enrollment-token flow.
                  </p>
                  <CommandBlock label="Advanced manual install" command={enrollment.advanced_manual_command} masked />
                </div>
              ) : null}
            </div>

            {guidedError ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{guidedError}</p>
              </div>
            ) : null}

            {testStatus === "error" && testError ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{testError}</p>
                </div>
                {remediationCommand ? <CommandBlock label="Suggested remediation command" command={remediationCommand} /> : null}
              </div>
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

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleStartGuidedSetup} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate command
              </Button>
              <Button onClick={handleFinalizeGuidedSetup} className="flex-1">
                {stage === "finalizing" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Finishing...</> : "Finish Setup & Test"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Connection Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {modes.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === m.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <m.icon className={`h-4 w-4 mb-1 ${mode === m.value ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-xs font-medium">{m.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Host Name</Label>
              <Input placeholder="e.g. prod-server-01" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{mode === "agent" ? "Agent URL" : "Tunnel URL"}</Label>
              <Input
                placeholder={mode === "agent" ? "https://your-host:9876" : "https://docker.your-team.cloudflareaccess.com"}
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Docker Socket Path <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="/var/run/docker.sock" value={socketPath} onChange={(e) => setSocketPath(e.target.value)} />
            </div>

            {mode === "cloudflare_tunnel" ? (
              <>
                <div className="space-y-2">
                  <Label>CF Access Service Token ID <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    placeholder="Only if CF Access is protecting the tunnel"
                    value={cfServiceTokenId}
                    onChange={(e) => setCfServiceTokenId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CF Access Service Token Secret <span className="text-muted-foreground">(optional)</span></Label>
                  <div className="relative">
                    <Input
                      type={showCfSecret ? "text" : "password"}
                      placeholder="Only if CF Access is protecting the tunnel"
                      value={cfServiceTokenSecret}
                      onChange={(e) => setCfServiceTokenSecret(e.target.value)}
                      className="pr-10"
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
              </>
            ) : null}

            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label>Agent API Key</Label>
                  <div className="relative">
                    <Input
                      type={showAgentKey ? "text" : "password"}
                      placeholder="Shared secret for authenticating with the agent"
                      value={agentApiKey}
                      onChange={(e) => setAgentApiKey(e.target.value)}
                      disabled={loadingSecrets}
                      className="pr-10"
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
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{testError}</p>
                  </div>
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

                <Button onClick={handleSaveEdit} disabled={!name || !hostUrl || isBusy || !agentApiKey.trim()} className="w-full">
                  {isBusy || testStatus === "testing" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes & Test Connection"}
                </Button>
              </>
            ) : (
              <>
                {guidedError ? (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{guidedError}</p>
                  </div>
                ) : null}

                <Button onClick={handleStartGuidedSetup} disabled={!name || !hostUrl || isBusy} className="w-full">
                  {isBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing...</> : "Generate Install Command"}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
