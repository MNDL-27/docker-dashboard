import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/clerk-react";
import { useToast } from "@/components/ui/use-toast";
import { useAddDockerHost } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import type { ConnectionMode } from "@/types/database";
import { deriveNeedsOnboarding, normalizeOnboardingStatus } from "@/lib/onboarding-gate";

/* ── Onboarding State Machine ── */
export type OnboardingStep =
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

/* ── Step Labels (top-level) ── */
export const STEPS = ["Create Organization", "Connect Host", "You're Ready"] as const;

/* ── Connection Mode Options ── */
export const CONNECTION_MODES: { value: ConnectionMode; label: string; desc: string }[] = [
  { value: "agent", label: "Agent (Direct)", desc: "Connect to the Watchtower Agent over HTTPS." },
  { value: "cloudflare_tunnel", label: "Agent via CF Tunnel", desc: "Same agent, accessed through a Cloudflare Tunnel." },
];

/* ── Derived state helpers ── */
export function isStep0Submitting(state: OnboardingStep): boolean {
  return state.step === 0 && (state.phase === "creating" || state.phase === "syncing");
}

export function isStep1Loading(state: OnboardingStep): boolean {
  return state.step === 1 && (state.phase === "saving" || state.phase === "testing");
}

export function getProgressWidth(state: OnboardingStep): string {
  if (state.step === 0) return "33%";
  if (state.step === 2) return "100%";
  if (state.phase === "basics") return "40%";
  return "60%";
}

/* ── API helper: mark onboarding status with retry logic ── */
async function markOnboardingStatus(
  status: "not_started" | "skipped" | "completed",
  orgId: string | null | undefined,
  fallbackOrgId: string | null | undefined,
) {
  const activeClerkOrgId = orgId ?? fallbackOrgId ?? null;

  const maxAttempts = 20;
  let delay = 750;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // @ts-expect-error window.Clerk is injected globally by ClerkProvider
    const token = await window.Clerk?.session?.getToken();
    if (!token) {
      throw new Error("Unauthorized");
    }

    const res = await fetch("/api/organizations", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        onboardingStatus: status,
        ...(activeClerkOrgId ? { clerkOrgId: activeClerkOrgId } : {}),
      }),
    });

    if (res.status === 202) {
      const data = await res.json().catch(() => ({}));
      if (data?.retry && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(Math.floor(delay * 1.35), 4000);
        continue;
      }
      throw new Error(data?.error || "Sync pending. Your account is currently syncing.");
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const isRetryableNotFound =
        res.status === 404 &&
        typeof data?.error === "string" &&
        data.error.toLowerCase().includes("requested organization not found");

      if (isRetryableNotFound && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(Math.floor(delay * 1.35), 4000);
        continue;
      }
      throw new Error(data?.error || `HTTP error ${res.status}`);
    }

    return;
  }
}

/* ══════════════════════════════════════════════════════════════════════
    useOnboardingState — single source of truth for the onboarding flow
   ══════════════════════════════════════════════════════════════════════ */
export function useOnboardingState() {
  const [state, setState] = useState<OnboardingStep>(() =>
    sessionStorage.getItem("onboarding_resume") === "connect-host"
      ? { step: 0, phase: "syncing" }
      : { step: 0, phase: "form" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoaded, orgId } = useAuth();
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

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

  const fallbackOrgId = userMemberships.data?.[0]?.organization?.id ?? null;

  /* ── Auto-advance to Step 1 if org already selected ── */
  useEffect(() => {
    if (isLoaded && orgId && state.step === 0 && state.phase === "form") {
      setState({ step: 1, phase: "basics" });
    }
  }, [isLoaded, orgId, state.step, state.phase]);

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

            if (res.status === 202) {
              const syncState = await res.json().catch(() => ({}));
              if (syncState?.retry) {
                await new Promise((r) => setTimeout(r, 2000));
                continue;
              }
            }

            if (res.ok) {
              const data = await res.json();
              const hasOrgs = !!data.user?.has_orgs;
              const onboardingStatus = normalizeOnboardingStatus(data.user?.onboarding_status);
              const needsOnboarding = deriveNeedsOnboarding(hasOrgs, onboardingStatus);

              if (hasOrgs && needsOnboarding) {
                if (!cancelled) {
                  toast({ title: "Organization created", description: "Now connect your first Docker host." });
                  setState({ step: 1, phase: "basics" });
                }
                return;
              }

              if (!needsOnboarding) {
                sessionStorage.removeItem("onboarding_resume");
                if (!cancelled) {
                  navigate("/app", { replace: true });
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

  /* ── Finalize onboarding and navigate away ── */
  const completeOnboardingAndNavigate = useCallback(async () => {
    try {
      await markOnboardingStatus("completed", orgId, fallbackOrgId);
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
        description:
          err instanceof Error
            ? err.message
            : "Unable to persist onboarding state. Please select an organization and try again.",
        variant: "destructive",
      });
    }
  }, [orgId, fallbackOrgId, navigate, toast]);

  /* ── Skip onboarding ── */
  const handleSkip = useCallback(async () => {
    setIsSkipping(true);
    setError(null);
    try {
      await markOnboardingStatus("skipped", orgId, fallbackOrgId);
      sessionStorage.removeItem("onboarding_resume");
      navigate("/app", { replace: true });
    } catch (err) {
      toast({
        title: "Still syncing your workspace",
        description:
          err instanceof Error
            ? err.message
            : "We couldn't finish yet. Please wait a moment and try again.",
      });
    } finally {
      setIsSkipping(false);
    }
  }, [orgId, fallbackOrgId, navigate, toast]);

  /* ── Step 0: Create Organization ── */
  const handleCreateOrg = useCallback(async () => {
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
  }, [orgName, createOrganization, setActive]);

  /* ── Step 1 Screen A → B validation ── */
  const handleBasicsNext = useCallback(() => {
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
  }, [hostName, hostUrl]);

  /* ── Step 1 Screen B: Save & Test ── */
  const handleSaveAndTest = useCallback(async () => {
    setError(null);
    if (!agentApiKey.trim()) {
      setError("Agent API key is required.");
      return;
    }
    const clerkOrgId = orgId ?? fallbackOrgId;
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

      setState({ step: 1, phase: "testing" });
      try {
        const result = await dockerApi.ping(host.id);
        if (result.ok) {
          toast({ title: "Host connected!", description: `"${hostName}" is verified and ready.` });
          setState({ step: 2, phase: "done" });
        } else {
          setTestError("Docker API did not respond with OK.");
          setState({ step: 1, phase: "test-failed" });
        }
      } catch (e: unknown) {
        setTestError(e instanceof Error ? e.message : "Connection test failed.");
        setState({ step: 1, phase: "test-failed" });
      }
    } catch (err: unknown) {
      setState({ step: 1, phase: "credentials" });
      setError(err instanceof Error ? err.message : "Failed to save host. Please try again.");
    }
  }, [agentApiKey, orgId, fallbackOrgId, hostName, hostUrl, connectionMode, socketPath, cfServiceTokenId, cfServiceTokenSecret, addHost, toast]);

  /* ── Retry connection test ── */
  const handleRetryTest = useCallback(async () => {
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
  }, [savedHostId, hostName, toast]);

  /* ── Navigate back from credentials to basics ── */
  const handleBackToBasics = useCallback(() => {
    setError(null);
    setState({ step: 1, phase: "basics" });
  }, []);

  return {
    // State
    state,
    error,
    isSkipping,
    testError,

    // Step 0
    orgName,
    setOrgName,
    handleCreateOrg,

    // Step 1
    hostName,
    setHostName,
    hostUrl,
    setHostUrl,
    connectionMode,
    setConnectionMode,
    socketPath,
    setSocketPath,
    agentApiKey,
    setAgentApiKey,
    cfServiceTokenId,
    setCfServiceTokenId,
    cfServiceTokenSecret,
    setCfServiceTokenSecret,

    // Handlers
    handleBasicsNext,
    handleSaveAndTest,
    handleRetryTest,
    handleBackToBasics,
    handleSkip,
    completeOnboardingAndNavigate,
  };
}
