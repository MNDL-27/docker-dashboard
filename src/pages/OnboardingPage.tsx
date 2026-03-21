import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Box, Building2, Loader2, CheckCircle2, ArrowRight, Server,
  Terminal, CloudCog, XCircle, Info, Check,
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
  // If resuming after a hard reload, start in syncing state to avoid a flash
  const [state, setState] = useState<OnboardingStep>(() =>
    sessionStorage.getItem("onboarding_resume") === "connect-host"
      ? { step: 0, phase: "syncing" }
      : { step: 0, phase: "form" }
  );
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoaded, orgId } = useAuth();
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  /* ── Auto-advance to Step 1 if Clerk organization is already selected ── */
  useEffect(() => {
    // If the user already has an active Clerk org, but the DB webhook hasn't fired yet
    // (causing `ProtectedRoute` to send them here), skip the duplicate org creation step.
    if (isLoaded && orgId && state.step === 0 && state.phase === "form") {
      setState({ step: 1, phase: "form" });
    }
  }, [isLoaded, orgId, state.step, state.phase]);

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

  /* ── Resume onboarding after hard reload ── */
  useEffect(() => {
    const resume = sessionStorage.getItem("onboarding_resume");
    if (resume !== "connect-host") return;

    let cancelled = false;

    (async () => {
      // Wait for the backend to reflect the new org (webhook may take a moment)
      const maxWait = 15_000;
      const start = Date.now();
      let delay = 500;

      while (Date.now() - start < maxWait) {
        if (cancelled) return;
        try {
          // @ts-expect-error window.Clerk is injected globally by ClerkProvider
          const token = await window.Clerk?.session?.getToken();
          if (token) {
            const res = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user?.has_orgs) {
                sessionStorage.removeItem("onboarding_resume");
                if (!cancelled) {
                  toast({ title: "Organization created", description: "Now connect your first Docker host." });
                  setState({ step: 1, phase: "form" });
                }
                return;
              }
            }
          }
        } catch {
          // transient error — retry
        }
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 2000);
      }

      // Timed out — fall back to Step 1
      sessionStorage.removeItem("onboarding_resume");
      if (!cancelled) {
        setState({ step: 0, phase: "form" });
        setError("Organization sync took too long. Please try creating your organization again.");
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Step 0: Org Creation ── */
  const handleCreateOrg = async () => {
    if (!orgName.trim() || !createOrganization) return;
    setError(null);

    try {
      setState({ step: 0, phase: "creating" });
      const org = await createOrganization({ name: orgName.trim() });

      // Set the new org as the active Clerk organization
      if (setActive && org) {
        await setActive({ organization: org.id });
      }

      // Persist resume flag and hard-reload to get a completely fresh Clerk session
      sessionStorage.setItem("onboarding_resume", "connect-host");
      window.location.assign("/onboarding");
    } catch (err: unknown) {
      setState({ step: 0, phase: "form" });
      setError(err instanceof Error ? err.message : "Failed to create organization. Please try again.");
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
      <header className="border-b border-border bg-background">
        <div className="w-full flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Onboarding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Step {currentStepIndex + 1} of {STEPS.length} — {STEPS[currentStepIndex]}
            </span>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-1 bg-border">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-in-out" 
            style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }} 
          />
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className={`w-full ${state.step === 1 ? "max-w-lg" : "max-w-md"}`}>

          {/* ═══════════════════════════════════════════════════════════════
              STEP 0: Create Organization
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 0 && state.phase === "form" && (
            <div className="animate-fade-in w-full">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">
                  Create your organization
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  Your organization is your team's workspace for managing Docker infrastructure.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="org-name" className="text-base font-medium">Organization name</Label>
                  <Input
                    id="org-name"
                    placeholder="e.g. Acme Cloud"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                    className="h-11"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You can rename this later in settings.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
                    {error}
                  </div>
                )}

                <Button className="w-full h-11 text-base" size="lg" onClick={handleCreateOrg} disabled={!orgName.trim()}>
                  Create Organization
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 0: Creating / Syncing */}
          {isStep0Submitting && (
            <div className="animate-fade-in w-full">
              <div className="bg-card border border-border rounded-xl shadow-lg p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">
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
            <div className="animate-fade-in w-full">
              {/* Header */}
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Server className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">
                  Add your first Docker host
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  Connect via the Watchtower Agent — no open Docker ports required.
                </p>
              </div>

              {/* Form Card */}
              <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
                {/* ── Host Details ── */}
                <div className="space-y-5">
                  {/* Host Name */}
                  <div className="space-y-2">
                    <Label htmlFor="host-name" className="text-base font-medium">Host Name</Label>
                    <Input
                      id="host-name"
                      placeholder="e.g. prod-server-01"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      className="h-11"
                      autoFocus
                    />
                  </div>

                  {/* URL */}
                  <div className="space-y-2">
                    <Label htmlFor="host-url" className="text-base font-medium">{connectionMode === "agent" ? "Agent URL" : "Tunnel URL"}</Label>
                    <Input
                      id="host-url"
                      placeholder={connectionMode === "agent" ? "https://your-host:9876" : "https://docker.your-team.cloudflareaccess.com"}
                      value={hostUrl}
                      onChange={(e) => setHostUrl(e.target.value)}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {connectionMode === "agent"
                        ? "The HTTPS URL where the Watchtower Agent is running."
                        : "The Cloudflare Tunnel public hostname that proxies the Docker socket."}
                    </p>
                  </div>

                  {/* Socket Path */}
                  <div className="space-y-2">
                    <Label htmlFor="socket-path" className="text-base font-medium">Docker Socket Path <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="socket-path"
                      placeholder="/var/run/docker.sock"
                      value={socketPath}
                      onChange={(e) => setSocketPath(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* ── Separator ── */}
                <div className="border-t border-border" />

                {/* ── Connection & Auth ── */}
                <div className="space-y-5">
                  {/* Connection Mode */}
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Connection Method</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {CONNECTION_MODES.map((m) => {
                        const isSelected = connectionMode === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setConnectionMode(m.value)}
                            className={`relative p-4 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                              </div>
                            )}
                            <m.icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            <div className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{m.label}</div>
                            <div className="text-xs text-muted-foreground mt-1 leading-snug">{m.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Agent API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="agent-key" className="text-base font-medium">Agent API Key</Label>
                    <Input
                      id="agent-key"
                      type="password"
                      placeholder="Shared secret for authenticating with the agent"
                      value={agentApiKey}
                      onChange={(e) => setAgentApiKey(e.target.value)}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Stored securely and <strong>never returned to the browser</strong> after saving.
                    </p>
                  </div>

                  {/* CF Tunnel fields */}
                  {connectionMode === "cloudflare_tunnel" && (
                    <>
                      <div className="space-y-1.5">
                        <Label>CF Access Service Token ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          placeholder="Only if CF Access is protecting the tunnel"
                          value={cfServiceTokenId}
                          onChange={(e) => setCfServiceTokenId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CF Access Service Token Secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          type="password"
                          placeholder="e.g. xyz789..."
                          value={cfServiceTokenSecret}
                          onChange={(e) => setCfServiceTokenSecret(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>

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
              </div>

              {/* Skip — outside the main card */}
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 py-1"
                onClick={() => setState({ step: 2, phase: "done" })}
              >
                Skip for now
              </button>

              {/* Helper info card */}
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The Watchtower Agent runs alongside Docker on your host. It requires no open ports and connects outbound over HTTPS.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Saving / Testing */}
          {isStep1Submitting && (
            <div className="animate-fade-in w-full">
              <div className="bg-card border border-border rounded-xl shadow-lg p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">
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
            <div className="animate-fade-in w-full">
              <div className="bg-card border border-border rounded-xl shadow-lg p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">You're all set!</h2>
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

                <div className="pt-2">
                  <Button className="w-full h-11 text-base gap-2" size="lg" onClick={() => navigate("/app")}>
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
