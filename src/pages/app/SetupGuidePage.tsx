import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Terminal, CloudCog, Copy, CheckCircle2, ShieldCheck, Server,
  ArrowRight, AlertTriangle, Lock, Globe, CheckCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      {label && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      )}
      <div className="bg-background border border-border rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
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
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {step}
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <h3 className="font-semibold text-base mb-3">{title}</h3>
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
    <div className={`flex items-start gap-2.5 p-3.5 rounded-lg border ${styles[variant]}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function SetupGuidePage() {
  const baseUrl = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.origin : "https://app.dockerdash.app";
  const installCommand = `curl -fsSL ${baseUrl}/watchtower-agent-install.sh -o watchtower-agent-install.sh
chmod +x watchtower-agent-install.sh
sudo ./watchtower-agent-install.sh`;
  const tunnelInstallCommand = installCommand;
  const serviceCommands = `sudo systemctl status watchtower-agent
sudo journalctl -u watchtower-agent -f
sudo systemctl restart watchtower-agent
sudo watchtower-agent-uninstall`;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Agent Setup Guide"
        description="Install and configure the Watchtower Agent on your Docker hosts"
        breadcrumbs={[{ label: "Help", href: "/app/help" }, { label: "Setup Guide" }]}
      />

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          How It Works
        </h2>
        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <Globe className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-sm font-semibold">Watchtower Dashboard</div>
            <div className="text-xs text-muted-foreground mt-1">Cloud-hosted UI and API</div>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="sm:hidden w-px h-6 bg-border" />
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <Server className="h-6 w-6 text-primary mx-auto mb-2" />
            <div className="text-sm font-semibold">Watchtower Agent</div>
            <div className="text-xs text-muted-foreground mt-1">Runs on your host and proxies to the Docker socket</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Watchtower Agent is a lightweight host service. It authenticates incoming requests with a shared API key,
          forwards them to Docker over the local Unix socket, and stays under your control.
          <strong> Your Docker socket is never exposed directly to the internet.</strong>
        </p>
      </div>

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="agent" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />Agent (Direct)
          </TabsTrigger>
          <TabsTrigger value="cloudflare" className="gap-1.5">
            <CloudCog className="h-3.5 w-3.5" />Agent via CF Tunnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="space-y-2">
          <StepCard step={1} title="Generate an API Key">
            <p className="text-sm text-muted-foreground">
              Create a strong random secret that will authenticate requests between the dashboard and your agent.
            </p>
            <CopyBlock code="openssl rand -hex 32" label="Generate a 256-bit key" />
            <p className="text-sm text-muted-foreground">Save this key. You will use it during install and when adding the host in Watchtower.</p>
          </StepCard>

          <StepCard step={2} title="Install the Agent">
            <p className="text-sm text-muted-foreground">
              Run the one-time Linux installer on your Docker host. It creates a dedicated service user, installs the
              agent into <code className="bg-muted px-1 rounded">/opt/watchtower-agent</code>, stores the config in
              <code className="bg-muted px-1 rounded ml-1">/etc/watchtower-agent/watchtower-agent.env</code>, and
              enables the service on boot. The installed runtime reports its own agent version so the dashboard can
              tell you when a host is behind.
            </p>
            <CopyBlock label="One-time Linux installer" code={installCommand} />
            <InfoBox>
              The installer prompts for the API key so it does not become the primary shell-history path for secrets.
              Default bind and port are <strong>127.0.0.1:9876</strong>.
              <br/><br/>
              To upgrade an existing host, rerun the same installer on that machine. It replaces the runtime in place
              and preserves the stored config.
              <br/><br/>
              <strong>Requirements:</strong> The Docker socket (<code className="bg-muted px-1 rounded">/var/run/docker.sock</code>) must be owned by a non-root group (like <code className="bg-muted px-1 rounded">docker</code>) so the agent service user can be granted access.
            </InfoBox>
            <CopyBlock
              label="Preflight only"
              code={`sudo ./watchtower-agent-install.sh --check`}
            />
          </StepCard>

          <StepCard step={3} title="Expose via HTTPS">
            <p className="text-sm text-muted-foreground">
              Direct agent mode must be reachable over HTTPS. Put the local agent behind a reverse proxy such as Caddy or nginx.
            </p>
            <CopyBlock
              label="Example Caddyfile"
              code={`docker-agent.example.com {
    reverse_proxy 127.0.0.1:9876
}`}
            />
            <CopyBlock
              label="Example nginx config"
              code={`server {
    listen 443 ssl;
    server_name docker-agent.example.com;

    ssl_certificate     /etc/ssl/certs/agent.crt;
    ssl_certificate_key /etc/ssl/private/agent.key;

    location / {
        proxy_pass http://127.0.0.1:9876;
        proxy_set_header Host $host;
    }
}`}
            />
          </StepCard>

          <StepCard step={4} title="Add Host in Watchtower">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Hosts → Connect Host</strong> and enter:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
              <li className="flex items-start gap-2"><Lock className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Connection mode:</strong> Agent (Direct)</span></li>
              <li className="flex items-start gap-2"><Globe className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Agent URL:</strong> <code className="bg-muted px-1 rounded">https://docker-agent.example.com</code></span></li>
              <li className="flex items-start gap-2"><ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Agent API Key:</strong> The key from step 1</span></li>
            </ul>
          </StepCard>

          <div className="pl-12">
            <InfoBox variant="success">
              Save the host and Watchtower will test the connection immediately.
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
              Use the same installer. It already binds to localhost by default, which is what Cloudflare Tunnel needs.
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
              Go to <strong>Hosts → Connect Host</strong> and enter:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
              <li className="flex items-start gap-2"><CloudCog className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Connection mode:</strong> Agent via CF Tunnel</span></li>
              <li className="flex items-start gap-2"><Globe className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Tunnel URL:</strong> <code className="bg-muted px-1 rounded">https://docker.your-team.com</code></span></li>
              <li className="flex items-start gap-2"><ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>Agent API Key:</strong> The key from step 1</span></li>
              <li className="flex items-start gap-2"><Lock className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" /> <span><strong>CF Access tokens:</strong> Only if you configured CF Access in step 4</span></li>
            </ul>
          </StepCard>

          <div className="pl-12">
            <InfoBox variant="success">
              The tunnel provides TLS and private routing without opening inbound ports on the host.
            </InfoBox>
          </div>
        </TabsContent>
      </Tabs>

      <div className="glass-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Agent Requirements</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "Linux + systemd", desc: "The guided installer targets standard Linux hosts with systemd" },
            { label: "Docker", desc: "Docker Engine 20.10+ installed and running" },
            { label: "Socket access", desc: "The service user must be able to read /var/run/docker.sock" },
            { label: "Runtime deps", desc: "bash, socat, and curl must already be installed on the host" },
          ].map((r) => (
            <div key={r.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-6 space-y-3">
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
