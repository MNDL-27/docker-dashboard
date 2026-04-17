import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Terminal,
  CloudCog,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Server,
  ArrowRight,
  AlertTriangle,
  Lock,
  Globe,
  CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buildWatchtowerAgentAdvancedInstallCommand,
  buildWatchtowerAgentLocalVerifyCommand,
  buildWatchtowerAgentPreflightCommand,
  buildWatchtowerAgentRepairCommand,
  CURRENT_WATCHTOWER_AGENT_RELEASE,
} from "@/lib/agent-release";

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {label ? <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-sm leading-relaxed">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 rounded-md bg-muted/80 p-1.5 text-muted-foreground opacity-0 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
          {step}
        </div>
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      <div className="min-w-0 flex-1 pb-8">
        <h3 className="mb-3 text-base font-semibold">{title}</h3>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ variant = "info", children }: { variant?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-primary/5 border-primary/20 text-primary",
    warning: "bg-warning/10 border-warning/20 text-warning",
    success: "bg-success/10 border-success/20 text-success",
  };
  const icons = {
    info: ShieldCheck,
    warning: AlertTriangle,
    success: CheckCheck,
  };
  const Icon = icons[variant];

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-3.5 ${styles[variant]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function SetupGuidePage() {
  const preflightCommand = buildWatchtowerAgentPreflightCommand();
  const updateCommand = buildWatchtowerAgentAdvancedInstallCommand({
    agentApiKey: "<agent-api-key>",
    connectionMode: "agent",
  });
  const verifyCommand = buildWatchtowerAgentLocalVerifyCommand();
  const repairCommand = buildWatchtowerAgentRepairCommand();
  const tunnelInstallCommand = buildWatchtowerAgentAdvancedInstallCommand({
    agentApiKey: "<agent-api-key>",
    connectionMode: "cloudflare_tunnel",
  });
  const serviceCommands = `sudo systemctl status watchtower-agent
sudo journalctl -u watchtower-agent -f
sudo systemctl restart watchtower-agent
sudo watchtower-agent-uninstall`;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <PageHeader
        title="Agent Setup Guide"
        description="Install and configure the Watchtower Agent on your Docker hosts"
        breadcrumbs={[{ label: "Help", href: "/app/help" }, { label: "Setup Guide" }]}
      />

      <div className="glass-card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          How It Works
        </h2>
        <div className="grid gap-4 text-center sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <Globe className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="text-sm font-semibold">Watchtower Dashboard</div>
            <div className="mt-1 text-xs text-muted-foreground">Cloud-hosted UI and API</div>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
            <div className="h-6 w-px bg-border sm:hidden" />
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <Server className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="text-sm font-semibold">Watchtower Agent</div>
            <div className="mt-1 text-xs text-muted-foreground">Runs on your host and proxies to the Docker socket</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Watchtower Agent is a lightweight host service. It authenticates incoming requests with a shared API key,
          forwards them to Docker over the local Unix socket, and stays under your control.
          <strong> Your Docker socket is never exposed directly to the internet.</strong>
        </p>
        <InfoBox variant="success">
          Preferred setup path: start from <strong>Connect Host</strong> or onboarding to get a one-time guided install command.
          This page is the manual reference flow and advanced fallback.
        </InfoBox>
      </div>

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="agent" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Agent (Direct)
          </TabsTrigger>
          <TabsTrigger value="cloudflare" className="gap-1.5">
            <CloudCog className="h-3.5 w-3.5" />
            Agent via CF Tunnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="space-y-2">
          <InfoBox>
            This flow is for Linux hosts with <code className="bg-muted px-1 rounded">systemd</code> and local operator access.
            The dashboard never runs privileged commands remotely.
          </InfoBox>

          <StepCard step={1} title="Generate key">
            <p className="text-sm text-muted-foreground">
              Create a strong random secret that will authenticate requests between the dashboard and your agent.
            </p>
            <CopyBlock code="openssl rand -hex 32" label="Generate API key" />
            <p className="text-sm text-muted-foreground">
              Save this key only if you are following the manual fallback path. The guided Dockerdash flow can generate a one-time install command for you instead.
            </p>
          </StepCard>

          <StepCard step={2} title="Preflight">
            <p className="text-sm text-muted-foreground">
              Check prerequisites before making any changes. This command verifies the installer, Docker socket access, and required host dependencies.
            </p>
            <CopyBlock label={`Preflight (${CURRENT_WATCHTOWER_AGENT_RELEASE.version})`} code={preflightCommand} />
            <InfoBox variant="warning">
              Preflight changes nothing. Fix any missing prerequisite, then rerun this step before updating.
            </InfoBox>
          </StepCard>

          <StepCard step={3} title="Update">
            <p className="text-sm text-muted-foreground">
              Run the manual install or in-place update on the host. It downloads the current installer, verifies its checksum, and preserves the stored config in <code className="bg-muted px-1 rounded">/etc/watchtower-agent/watchtower-agent.env</code>.
            </p>
            <CopyBlock label={`Manual Install / Update (${CURRENT_WATCHTOWER_AGENT_RELEASE.tag})`} code={updateCommand} />
            <InfoBox>
              The update is atomic: the installer is only executed after the checksum matches. If the host already has the agent, rerunning this command replaces the runtime in place.
            </InfoBox>
          </StepCard>

          <StepCard step={4} title="Verify">
            <p className="text-sm text-muted-foreground">
              Confirm the local runtime is healthy after the update. This verify command reads the local env file and checks both <code className="bg-muted px-1 rounded">/agent/version</code> and <code className="bg-muted px-1 rounded">/metrics</code>.
            </p>
            <CopyBlock label="Verify agent endpoints" code={verifyCommand} />
          </StepCard>

          <StepCard step={5} title="Troubleshoot">
            <p className="text-sm text-muted-foreground">
              If the host still misses uptime or per-disk fields after verification, rerun the repair flow and inspect the service logs locally.
            </p>
            <CopyBlock label="Troubleshoot / Repair" code={repairCommand} />
            <InfoBox>
              Repair is the same reinstall path plus local diagnostics. It preserves the existing config and helps confirm whether the failure is in the service, the socket, or the metrics payload.
            </InfoBox>
          </StepCard>

          <div className="pl-12">
            <InfoBox variant="success">
              Once Preflight, Update, and Verify pass, add the host in Watchtower with the same API key.
            </InfoBox>
          </div>
        </TabsContent>

        <TabsContent value="cloudflare" className="space-y-2">
          <InfoBox>
            This mode reaches the same Watchtower Agent through a Cloudflare Tunnel. The API key still authenticates the
            requests. The tunnel only changes how traffic reaches the host.
          </InfoBox>

          <StepCard step={1} title="Generate an API Key">
            <CopyBlock code="openssl rand -hex 32" label="Generate a 256-bit key" />
          </StepCard>

          <StepCard step={2} title="Install the Agent on Your Host">
            <p className="text-sm text-muted-foreground">
              Use the same manual installer fallback. It binds to <code className="bg-muted px-1 rounded">0.0.0.0</code> by default, and Cloudflare Tunnel can still forward to the local agent port on the host.
            </p>
            <CopyBlock label="Install for tunnel-only access" code={tunnelInstallCommand} />
            <InfoBox>
              You can change <code className="bg-muted px-1 rounded">AGENT_BIND_ADDRESS</code> later in
              <code className="bg-muted px-1 rounded ml-1">/etc/watchtower-agent/watchtower-agent.env</code>.
            </InfoBox>
          </StepCard>

          <StepCard step={3} title="Create a Cloudflare Tunnel">
            <p className="text-sm text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">cloudflared</code> to create a tunnel pointing to the agent.
            </p>
            <CopyBlock
              label="Install cloudflared"
              code={`# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared`}
            />
            <CopyBlock
              label="Create and route tunnel"
              code={`cloudflared tunnel create watchtower-agent
cloudflared tunnel route dns watchtower-agent docker.your-team.com
cloudflared tunnel run --url http://127.0.0.1:9876 watchtower-agent`}
            />
          </StepCard>

          <StepCard step={4} title="(Optional) Protect with CF Access">
            <p className="text-sm text-muted-foreground">
              Add a Cloudflare Access policy to the tunnel hostname for an extra authentication layer. Create a service token
              in Cloudflare if you want Watchtower to present CF Access credentials too.
            </p>
          </StepCard>

          <StepCard step={5} title="Add Host in Watchtower">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Hosts - Connect Host</strong> and enter:
            </p>
            <ul className="ml-4 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CloudCog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Connection mode:</strong> Agent via CF Tunnel
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Tunnel URL:</strong> <code className="bg-muted px-1 rounded">https://docker.your-team.com</code>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Agent API Key:</strong> The key from step 1
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  <strong>CF Access tokens:</strong> Only if you configured CF Access in step 4
                </span>
              </li>
            </ul>
          </StepCard>

          <div className="pl-12">
            <InfoBox variant="success">
              The tunnel provides TLS and private routing without opening inbound ports on the host.
            </InfoBox>
          </div>
        </TabsContent>
      </Tabs>

      <div className="glass-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Agent Requirements</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Linux + systemd", desc: "The guided installer targets standard Linux hosts with systemd" },
            { label: "Docker", desc: "Docker Engine 20.10+ installed and running" },
            { label: "Socket access", desc: "The service user must be able to read /var/run/docker.sock" },
            { label: "Runtime deps", desc: "bash, socat, curl, and jq must already be installed on the host" },
          ].map((r) => (
            <div key={r.label} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Operate the Service</h2>
        <p className="text-sm text-muted-foreground">
          After installation, these are the main commands for status, logs, restart, and uninstall.
        </p>
        <CopyBlock code={serviceCommands} label="Lifecycle commands" />
        <InfoBox>
          If your host does not use <code className="bg-muted px-1 rounded">systemd</code>, wrap
          <code className="bg-muted px-1 rounded ml-1">watchtower-agent.sh</code> with your existing process manager. If you
          already standardize on Docker-based host services, use restart behavior such as
          <code className="bg-muted px-1 rounded ml-1">--restart unless-stopped</code>.
        </InfoBox>
      </div>
    </div>
  );
}
