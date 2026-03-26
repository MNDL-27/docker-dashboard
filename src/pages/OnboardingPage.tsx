import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Box, Building2, Loader2, CheckCircle2, ArrowRight, Server,
  Terminal, CloudCog, XCircle, Info, Check, ArrowLeft, Copy, AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAddDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import type { ConnectionMode } from "@/types/database";
import { apiFetch } from "@/lib/api";

/* ── Step Labels (top-level) ── */
const STEPS = ["Create Organization", "Connect Host", "You're Ready"] as const;

/* ── Connection Mode Options ── */
const CONNECTION_MODES: { value: ConnectionMode; label: string; icon: typeof Terminal; desc: string }[] = [
  { value: "agent", label: "Agent (Direct)", icon: Terminal, desc: "Connect to the Watchtower Agent over HTTPS." },
  { value: "cloudflare_tunnel", label: "Agent via CF Tunnel", icon: CloudCog, desc: "Same agent, accessed through a Cloudflare Tunnel." },
];

/* ── CopyBlock Component (adapted from SetupGuidePage) ── */
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
      <div className="bg-background border border-border rounded-lg p-3.5 font-mono text-xs leading-relaxed overflow-x-auto">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

/* ── Onboarding State Machine ── */
type OnboardingStep =
  // Step 0: Create Org
  | { step: 0; phase: "form" }
  | { step: 0; phase: "creating" }
  | { step: 0; phase: "syncing" }
  // Step 1: Connect Host — Screen A (basics)
  | { step: 1; phase: "basics" }
  // Step 1: Connect Host — Screen B (credentials + test)
  | { step: 1; phase: "credentials" }
  | { step: 1; phase: "saving" }
  | { step: 1; phase: "testing" }
  | { step: 1; phase: "test-failed" }
  // Step 2: Completion (success only)
  | { step: 2; phase: "done" };

export default function OnboardingPage() {
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
    if (isLoaded && orgId && state.step === 0 && state.phase === "form") {
      sessionStorage.removeItem("onboarding_resume");
      setState({ step: 1, phase: "basics" });
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
  const [testError, setTestError] = useState("");
  const [savedHostId, setSavedHostId] = useState<string | null>(null);

  const addHost = useAddDockerHost();
  const baseUrl = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.origin : "https://app.dockerdash.app";
  const quickInstallCommand = `curl -fsSL ${baseUrl}/watchtower-agent-install.sh -o watchtower-agent-install.sh
chmod +x watchtower-agent-install.sh
sudo ./watchtower-agent-install.sh`;

  const markOnboardingStatus = async (status: "not_started" | "skipped" | "completed") => {
    await apiFetch('/organizations', {
      method: 'PATCH',
      body: JSON.stringify({ onboardingStatus: status }),
    });
  };

  const completeOnboardingAndNavigate = async () => {
    try {
      await markOnboardingStatus("completed");
      sessionStorage.removeItem("onboarding_resume");
      const pendingPlan = sessionStorage.getItem("dockerdash_pending_plan");
      if (pendingPlan) {
        navigate(`/app/billing?plan=${pendingPlan}`, { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    } catch (err) {
      toast({
        title: "Couldn't finalize onboarding",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  /* ── Resume onboarding after hard reload ── */
  useEffect(() => {
    const resume = sessionStorage.getItem("onboarding_resume");
    if (resume !== "connect-host") return;
    let cancelled = false;
    (async () => {
      const maxWait = 30_000;
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
                  setState({ step: 1, phase: "basics" });
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
      if (setActive && org) {
        await setActive({ organization: org.id });
      }
      sessionStorage.setItem("onboarding_resume", "connect-host");
      window.location.assign("/onboarding");
    } catch (err: unknown) {
      setState({ step: 0, phase: "form" });
      setError(err instanceof Error ? err.message : "Failed to create organization. Please try again.");
    }
  };

  /* ── Screen A → B validation ── */
  const handleBasicsNext = () => {
    setError(null);
    if (!hostName.trim()) {
      setError("Host name is required.");
      return;
    }
    try {
      new URL(hostUrl);
    } catch {
      setError("Enter a valid URL (e.g. https://agent.example.com:9876)");
      return;
    }
    setState({ step: 1, phase: "credentials" });
  };

  /* ── Screen B: Save & Test ── */
  const handleSaveAndTest = async () => {
    setError(null);
    if (!agentApiKey.trim()) {
      setError("Agent API key is required.");
      return;
    }
    const clerkOrgId = userMemberships.data?.[0]?.organization?.id;
    if (!clerkOrgId) {
      setError("No active organization found. Please refresh the page.");
      return;
    }
    try {
      setState({ step: 1, phase: "saving" });
      const host = await addHost.mutateAsync({
        orgId: clerkOrgId,
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
      setSavedHostId(host.id);

      // Test connection
      setState({ step: 1, phase: "testing" });
      try {
        const result = await dockerApi.ping(host.id);
        if (result.ok) {
          toast({ title: "Host connected!", description: `"${hostName}" is verified and ready.` });
          setState({ step: 2, phase: "done" }); // Success Path → Screen C
        } else {
          setTestError("Docker API did not respond with OK.");
          setState({ step: 1, phase: "test-failed" }); // Failed-but-saved Path
        }
      } catch (e: unknown) {
        setTestError(e instanceof Error ? e.message : "Connection test failed.");
        setState({ step: 1, phase: "test-failed" }); // Failed-but-saved Path
      }
    } catch (err: unknown) {
      setState({ step: 1, phase: "credentials" });
      setError(err instanceof Error ? err.message : "Failed to save host. Please try again.");
    }
  };

  /* ── Retry connection test ── */
  const handleRetryTest = async () => {
    if (!savedHostId) return;
    setTestError("");
    setState({ step: 1, phase: "testing" });
    try {
      const result = await dockerApi.ping(savedHostId);
      if (result.ok) {
        toast({ title: "Connection verified!", description: `"${hostName}" is now connected.` });
        setState({ step: 2, phase: "done" });
      } else {
        setTestError("Docker API did not respond with OK.");
        setState({ step: 1, phase: "test-failed" });
      }
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : "Connection test failed.");
      setState({ step: 1, phase: "test-failed" });
    }
  };

  /* ── Derived ── */
  const currentStepIndex = state.step;
  const isStep0Submitting = state.step === 0 && (state.phase === "creating" || state.phase === "syncing");
  const isStep1Loading = state.step === 1 && (state.phase === "saving" || state.phase === "testing");

  /* ── Progress bar calculation ── */
  const getProgressWidth = () => {
    if (state.step === 0) return "33%";
    if (state.step === 2) return "100%";
    // Step 1 sub-steps: basics = 40%, credentials/testing = 60%, test-failed = 60%
    if (state.phase === "basics") return "40%";
    return "60%";
  };

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
            style={{ width: getProgressWidth() }}
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
              STEP 1, SCREEN A: Host Basics
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 1 && state.phase === "basics" && (
            <div className="animate-fade-in w-full">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Server className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">
                  Add your first Docker host
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  Connect via the Watchtower Agent with a reverse proxy or Cloudflare Tunnel in front of it.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
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

                {/* Connection Mode as card choices */}
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

                {/* Agent / Tunnel URL */}
                <div className="space-y-2">
                  <Label htmlFor="host-url" className="text-base font-medium">
                    {connectionMode === "agent" ? "Agent URL" : "Tunnel URL"}
                  </Label>
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
                      : "The Cloudflare Tunnel public hostname."}
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <Button className="w-full h-11 text-base" size="lg" onClick={handleBasicsNext} disabled={!hostName || !hostUrl}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {/* Skip — outside the main card */}
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 py-1"
                onClick={async () => {
                  try {
                    await markOnboardingStatus("skipped");
                    sessionStorage.removeItem("onboarding_resume");
                    navigate("/app", { replace: true });
                  } catch (err) {
                    toast({
                      title: "Couldn't skip onboarding",
                      description: err instanceof Error ? err.message : "Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Skip for now
              </button>

              {/* Helper info card */}
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The Watchtower Agent runs alongside Docker on your host. Keep it on localhost and expose it through HTTPS or Cloudflare Tunnel.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 1, SCREEN B: Credentials / Setup / Test
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 1 && state.phase === "credentials" && (
            <div className="animate-fade-in w-full">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">
                  Connect &amp; verify
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  Enter your agent credentials and we'll test the connection.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
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
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Stored securely and <strong>never returned to the browser</strong> after saving.
                  </p>
                </div>

                {/* Docker Socket Path */}
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

                {/* Separator */}
                <div className="border-t border-border" />

                {/* Install snippet */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Terminal className="h-4 w-4 text-primary" />
                    Quick agent install
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If you have not installed the agent yet, run this once on your Linux Docker host. The installer will prompt
                    for the API key and register the service with systemd.
                  </p>
                  <CopyBlock
                    label="One-time Linux installer"
                    code={quickInstallCommand}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The installer prompts for the same API key you enter here. Default bind and port:
                    <code className="bg-muted px-1 rounded ml-1">127.0.0.1:9876</code>.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => { setError(null); setState({ step: 1, phase: "basics" }); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button className="flex-1 h-11 text-base" size="lg" onClick={handleSaveAndTest} disabled={!agentApiKey.trim()}>
                    Save &amp; Test Connection
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Saving / Testing loading state */}
          {isStep1Loading && (
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
              STEP 1: Test Failed — Host Saved but Connection Not Verified
             ═══════════════════════════════════════════════════════════════ */}
          {state.step === 1 && state.phase === "test-failed" && (
            <div className="animate-fade-in w-full">
              <div className="text-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="h-7 w-7 text-warning" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-3">
                  Host saved, connection not verified
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  <strong>"{hostName}"</strong> was saved to your workspace, but the connection test didn't pass.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-lg p-8 space-y-6">
                {/* Error detail */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-warning/20 bg-warning/5">
                  <XCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm text-warning leading-relaxed">{testError || "Connection test failed."}</div>
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
                  <p>Common causes:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Agent is not running on the host</li>
                    <li>Firewall blocking HTTPS traffic to the agent port</li>
                    <li>API key mismatch between dashboard and agent</li>
                    <li>URL or port is incorrect</li>
                  </ul>
                </div>

                <div className="border-t border-border" />

                <div className="flex gap-3">
                  <Button variant="outline" className="h-11" onClick={handleRetryTest}>
                    Retry Connection
                  </Button>
                  <Button
                    className="flex-1 h-11 text-base"
                    variant="secondary"
                    onClick={completeOnboardingAndNavigate}
                  >
                    Finish Later
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  You can retry or edit this host anytime from <strong>Hosts</strong> in the dashboard.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 2: SUCCESS — Celebration (only after verified connection)
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
                    Your workspace is ready and your host is connected. Head to your dashboard to start monitoring.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <p className="text-xs text-primary">Host connection verified!</p>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full h-11 text-base gap-2"
                    size="lg"
                    onClick={completeOnboardingAndNavigate}
                  >
                    {sessionStorage.getItem("dockerdash_pending_plan") ? "Continue to Billing" : "Go to Dashboard"}
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
