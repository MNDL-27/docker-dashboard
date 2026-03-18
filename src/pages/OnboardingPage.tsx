import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Box, Building2, Loader2, CheckCircle2, ArrowRight, Server,
  Terminal, CloudCog, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAddDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import type { ConnectionMode } from "@/types/database";

const STEPS = ["Create Organization", "Connect Host", "You're Ready"] as const;

/* ── Connection Mode Options ── */
const CONNECTION_MODES: { value: ConnectionMode; label: string; icon: typeof Terminal; desc: string }[] = [
  { value: "agent", label: "Agent (Direct)", icon: Terminal, desc: "Connect to the Watchtower Agent over HTTPS." },
  { value: "cloudflare_tunnel", label: "Agent via CF Tunnel", icon: CloudCog, desc: "Same agent, accessed through a Cloudflare Tunnel." },
];

/* ── Onboarding State Machine ── */
type OnboardingStep =
  | { step: 0; phase: "form" }
  | { step: 0; phase: "creating" }
  | { step: 0; phase: "syncing" }
  | { step: 1; phase: "form" }
  | { step: 1; phase: "saving" }
  | { step: 1; phase: "testing" }
  | { step: 2; phase: "done" };

export default function OnboardingPage() {
  const [state, setState] = useState<OnboardingStep>({ step: 0, phase: "form" });
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Step 0 State ── */
  const [orgName, setOrgName] = useState("");

  /* ── Step 1 State ── */
  const [hostName, setHostName] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("agent");
  const [socketPath, setSocketPath] = useState("/var/run/docker.sock");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [cfServiceTokenId, setCfServiceTokenId] = useState("");
  const [cfServiceTokenSecret, setCfServiceTokenSecret] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const addHost = useAddDockerHost();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /* ── Step 0: Org Creation ── */
  const pollForOrgSync = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30;
      let consecutiveAuthFailures = 0;
      const maxAuthFailures = 5;

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const token = await getToken();

          // Token not ready yet (Clerk session still refreshing) — skip this tick
          if (!token) {
            consecutiveAuthFailures++;
            if (consecutiveAuthFailures >= maxAuthFailures) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error("Authentication failed after creating your organization. Please refresh the page and try again."));
            }
            return;
          }

          consecutiveAuthFailures = 0; // valid token obtained

          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user?.has_orgs) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              resolve();
              return;
            }
          } else if (res.status === 401) {
            consecutiveAuthFailures++;
            if (consecutiveAuthFailures >= maxAuthFailures) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error("Authentication failed after creating your organization. Please refresh the page and try again."));
            }
            return; // don't count toward normal timeout
          }
        } catch {
          // Ignore transient network errors
        }
        if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          reject(new Error("Organization sync timed out. Please refresh the page."));
        }
      }, 1000);
    });
  }, [getToken]);

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !createOrganization) return;
    setError(null);

    try {
      setState({ step: 0, phase: "creating" });
      const org = await createOrganization({ name: orgName.trim() });

      // Set the new org as the active Clerk organization so the session token includes orgId
      if (setActive && org) {
        await setActive({ organization: org.id });
      }

      // Give Clerk time to refresh the session token after org switch
      await new Promise((r) => setTimeout(r, 1500));

      setState({ step: 0, phase: "syncing" });
      await pollForOrgSync();

      toast({
        title: "Organization created",
        description: `"${orgName.trim()}" is ready to go.`,
      });

      // Advance to Step 1: Connect Host
      setState({ step: 1, phase: "form" });
    } catch (err: any) {
      setState({ step: 0, phase: "form" });
      setError(err?.message || "Failed to create organization. Please try again.");
    }
  };

  /* ── Step 1: Connect Host ── */
  const handleConnectHost = async () => {
    setError(null);

    // Validate URL
    try {
      new URL(hostUrl);
    } catch {
      setError("Enter a valid URL (e.g. https://agent.example.com:9876)");
      return;
    }

    if (!agentApiKey.trim()) {
      setError("Agent API key is required.");
      return;
    }

    // Get the active org ID from the Clerk membership list
    const orgId = userMemberships.data?.[0]?.organization?.id;
    if (!orgId) {
      setError("No active organization found. Please refresh the page.");
      return;
    }

    try {
      setState({ step: 1, phase: "saving" });

      const host = await addHost.mutateAsync({
        orgId,
        name: hostName,
        hostUrl,
        connectionMode,
        dockerSocketPath: socketPath,
        secrets: {
          agentApiKey: agentApiKey.trim(),
          ...(connectionMode === "cloudflare_tunnel" && {
            cfServiceTokenId: cfServiceTokenId.trim() || undefined,
            cfServiceTokenSecret: cfServiceTokenSecret.trim() || undefined,
          }),
        },
      });

      // Test connection
      setState({ step: 1, phase: "testing" });
      try {
        const result = await dockerApi.ping(host.id);
        setTestStatus(result.ok ? "success" : "error");
        if (!result.ok) setTestError("Docker API did not respond with OK");
      } catch (e: any) {
        setTestStatus("error");
        setTestError(e.message);
      }

      toast({
        title: "Host connected!",
        description: `"${hostName}" has been added to your workspace.`,
      });

      // Advance to Step 2: Success
      setState({ step: 2, phase: "done" });
    } catch (err: any) {
      setState({ step: 1, phase: "form" });
      setError(err?.message || "Failed to connect host. Please try again.");
    }
  };

  /* ── Derived ── */
  const currentStepIndex = state.step;
  const isStep0Submitting = state.step === 0 && (state.phase === "creating" || state.phase === "syncing");
  const isStep1Submitting = state.step === 1 && (state.phase === "saving" || state.phase === "testing");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Header Bar ── */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Watchtower</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                      ${i < currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : i === currentStepIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {i < currentStepIndex ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-xs hidden sm:inline ${
                      i <= currentStepIndex ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-6 h-px ${
                      i < currentStepIndex ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* ═══════════════════════════════════════════════════════════════
              STEP 0: Create Organization
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 0 && state.phase === "form" && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                  Create your organization
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your organization is your team's workspace for managing Docker infrastructure.
                </p>
              </div>

              <div className="glass-card p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    placeholder="e.g. Acme Cloud"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You can rename this later in settings.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button className="w-full" size="lg" onClick={handleCreateOrg} disabled={!orgName.trim()}>
                  Create Organization
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 0: Creating / Syncing */}
          {isStep0Submitting && (
            <div className="animate-fade-in">
              <div className="glass-card p-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    {state.phase === "creating" ? "Creating organization…" : "Syncing your workspace…"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {state.phase === "creating"
                      ? `Setting up "${orgName.trim()}"…`
                      : "Finishing setup. This usually takes a few seconds."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 1: Connect Host
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 1 && state.phase === "form" && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Server className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                  Connect your first host
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Add a Docker host via the Watchtower Agent. No open Docker ports required.
                </p>
              </div>

              <div className="glass-card p-6 space-y-5">
                {/* Connection Mode */}
                <div className="space-y-2">
                  <Label>Connection Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONNECTION_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setConnectionMode(m.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          connectionMode === m.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <m.icon className={`h-4 w-4 mb-1 ${connectionMode === m.value ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="text-xs font-medium">{m.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Host Name */}
                <div className="space-y-2">
                  <Label htmlFor="host-name">Host Name</Label>
                  <Input
                    id="host-name"
                    placeholder="e.g. prod-server-01"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* URL */}
                <div className="space-y-2">
                  <Label htmlFor="host-url">{connectionMode === "agent" ? "Agent URL" : "Tunnel URL"}</Label>
                  <Input
                    id="host-url"
                    placeholder={connectionMode === "agent" ? "https://your-host:9876" : "https://docker.your-team.cloudflareaccess.com"}
                    value={hostUrl}
                    onChange={(e) => setHostUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {connectionMode === "agent"
                      ? "The HTTPS URL where the Watchtower Agent is running."
                      : "The Cloudflare Tunnel public hostname that proxies the Docker socket."}
                  </p>
                </div>

                {/* Socket Path */}
                <div className="space-y-2">
                  <Label htmlFor="socket-path">Docker Socket Path <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="socket-path"
                    placeholder="/var/run/docker.sock"
                    value={socketPath}
                    onChange={(e) => setSocketPath(e.target.value)}
                  />
                </div>

                {/* Agent API Key */}
                <div className="space-y-2">
                  <Label htmlFor="agent-key">Agent API Key</Label>
                  <Input
                    id="agent-key"
                    type="password"
                    placeholder="Shared secret for authenticating with the agent"
                    value={agentApiKey}
                    onChange={(e) => setAgentApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored securely and <strong>never returned to the browser</strong> after saving.
                  </p>
                </div>

                {/* CF Tunnel fields */}
                {connectionMode === "cloudflare_tunnel" && (
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
                      <Input
                        type="password"
                        placeholder="e.g. xyz789..."
                        value={cfServiceTokenSecret}
                        onChange={(e) => setCfServiceTokenSecret(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                {/* CTA */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleConnectHost}
                  disabled={!hostName || !hostUrl}
                >
                  Save & Test Connection
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>

                {/* Skip */}
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setState({ step: 2, phase: "done" })}
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Saving / Testing */}
          {isStep1Submitting && (
            <div className="animate-fade-in">
              <div className="glass-card p-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    {state.phase === "saving" ? "Adding host…" : "Testing connection…"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {state.phase === "saving"
                      ? `Saving "${hostName}" to your workspace…`
                      : "Verifying Docker API connectivity. This may take a moment."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 2: Success / You're Ready
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 2 && (
            <div className="animate-fade-in">
              <div className="glass-card p-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">You're all set!</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your workspace is ready. Head to your dashboard to start monitoring.
                  </p>
                </div>

                {testStatus === "success" && (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-xs text-primary">Host connection verified!</p>
                  </div>
                )}
                {testStatus === "error" && testError && (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20">
                    <XCircle className="h-4 w-4 text-warning" />
                    <p className="text-xs text-warning">Host saved but test failed: {testError}</p>
                  </div>
                )}

                <Button className="gap-2" size="lg" onClick={() => navigate("/app")}>
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
