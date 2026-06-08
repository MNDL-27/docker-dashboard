import { useState } from "react";
import { Copy, ExternalLink, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { COPY_FEEDBACK_DURATION_MS } from "@/lib/constants";
import type { DockerHost } from "@/types/database";
import {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  buildWatchtowerAgentPreflightCommand,
  buildWatchtowerAgentUpdateCopy,
  buildWatchtowerAgentUpgradeCommand,
  buildWatchtowerAgentRepairCommand,
  buildWatchtowerAgentVerifyCommand,
  getWatchtowerAgentUpdateStatusCopy,
} from "@/lib/agent-release";

function statusTone(status: string) {
  switch (status) {
    case "current":
      return "border-success/20 bg-success/10 text-success";
    case "update_required":
      return "border-warning/20 bg-warning/10 text-warning";
    case "verification_required":
      return "border-primary/20 bg-primary/10 text-primary";
    case "pending":
    default:
      return "border-white/10 bg-background/60 text-muted-foreground";
  }
}

function statusSummaryTone(status: string) {
  switch (status) {
    case "current":
      return "text-success";
    case "update_required":
      return "text-warning";
    case "verification_required":
      return "text-primary";
    case "pending":
    default:
      return "text-muted-foreground";
  }
}

function AgentCommandBlock({
  label,
  command,
}: {
  label: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    window.setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-foreground/90">{command}</pre>
      </div>
    </div>
  );
}

function UpdateCommandSection({
  title,
  description,
  command,
}: {
  title: string;
  description: string;
  command: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-background/40 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <AgentCommandBlock label={title} command={command} />
    </div>
  );
}

export function AgentUpdateDialog({
  host,
  trigger,
  status,
  statusCopy,
  verificationReason,
}: {
  host: DockerHost;
  trigger: React.ReactNode;
  status: string;
  statusCopy: { title: string; description: string };
  verificationReason: string | null;
}) {
  const normalizedStatus =
    status === "current" || status === "update_required" || status === "verification_required"
      ? status
      : "pending";
  const resolvedStatusCopy = statusCopy ?? getWatchtowerAgentUpdateStatusCopy(normalizedStatus, CURRENT_WATCHTOWER_AGENT_RELEASE);
  const updateCopy = buildWatchtowerAgentUpdateCopy(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const installedVersion = host.agent_version || "Pending";
  const latestVersion = CURRENT_WATCHTOWER_AGENT_RELEASE.version;
  const preflightCommand = buildWatchtowerAgentPreflightCommand(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const upgradeCommand = buildWatchtowerAgentUpgradeCommand(CURRENT_WATCHTOWER_AGENT_RELEASE);
  const verifyCommand = buildWatchtowerAgentVerifyCommand();
  const repairCommand = buildWatchtowerAgentRepairCommand();
  const dialogTitle =
    normalizedStatus === "verification_required"
      ? "Verify Host Agent"
      : normalizedStatus === "current"
        ? "Host Agent"
        : "Update Host Agent";

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{updateCopy.dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Installed version</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{installedVersion}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Latest approved</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{latestVersion}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Status</p>
              <p className={cn("mt-2 text-2xl font-semibold tracking-tight", statusSummaryTone(normalizedStatus))}>{resolvedStatusCopy.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{resolvedStatusCopy.description}</p>
            </div>
          </div>

          <div className={cn("rounded-2xl border p-4 text-sm", statusTone(normalizedStatus))}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] opacity-80">Current state</p>
                <p className="mt-2 text-base font-medium">{resolvedStatusCopy.title}</p>
                <p className="mt-1 text-sm opacity-90">{resolvedStatusCopy.description}</p>
              </div>
              <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]">
                {normalizedStatus}
              </span>
            </div>
            {verificationReason ? (
              <p className="mt-4 rounded-xl border border-white/10 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                {verificationReason}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
            {updateCopy.sourcePrefix}{" "}
            <a
              href={CURRENT_WATCHTOWER_AGENT_RELEASE.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {CURRENT_WATCHTOWER_AGENT_RELEASE.sourceLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {updateCopy.sourceNotice ? ` ${updateCopy.sourceNotice}` : ""}
          </div>

          <div className="grid gap-4">
            <UpdateCommandSection
              title={updateCopy.preflightCommandLabel}
              description="Checks prerequisites and verifies the installer automatically before making any changes."
              command={preflightCommand}
            />
            <UpdateCommandSection
              title={updateCopy.upgradeCommandLabel}
              description="Downloads the current installer, verifies it automatically, and runs the in-place update."
              command={upgradeCommand}
            />
            <UpdateCommandSection
              title={updateCopy.verifyCommandLabel}
              description="Confirms the local agent version and metrics endpoints after the update."
              command={verifyCommand}
            />
            <UpdateCommandSection
              title={updateCopy.repairCommandLabel}
              description="Use this when the host needs repair guidance after a failed or partial update."
              command={repairCommand}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/50 p-4 text-sm text-muted-foreground">
            {updateCopy.supportInstructions}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
