import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/react";
import { useToast } from "@/components/ui/use-toast";
import { agentEnrollmentApi, type AgentEnrollmentCreateResponse, type AgentEnrollmentFinalizeResponse } from "@/services/agent-enrollment";
import type { ConnectionMode } from "@/types/database";
import { deriveNeedsOnboarding, normalizeOnboardingStatus } from "@/lib/onboarding-gate";

export type OnboardingStep =
  | { step: 0; phase: "form" }
  | { step: 0; phase: "creating" }
  | { step: 0; phase: "syncing" }
  | { step: 1; phase: "basics" }
  | { step: 1; phase: "preparing" }
  | { step: 1; phase: "install" }
  | { step: 1; phase: "finalizing" }
  | { step: 1; phase: "test-failed" }
  | { step: 2; phase: "done" };

export const STEPS = ["Create Organization", "Connect Host", "You're Ready"] as const;

export const CONNECTION_MODES: { value: ConnectionMode; label: string; desc: string }[] = [
  { value: "agent", label: "Agent (HTTPS)", desc: "Connect to the Watchtower Agent over HTTPS." },
  { value: "http", label: "Agent (HTTP)", desc: "Connect to the Watchtower Agent over standard HTTP." },
  { value: "cloudflare_tunnel", label: "Agent via CF Tunnel", desc: "Same agent, accessed through a Cloudflare Tunnel." },
];

export function isStep0Submitting(state: OnboardingStep): boolean {
  return state.step === 0 && (state.phase === "creating" || state.phase === "syncing");
}

export function isStep1Loading(state: OnboardingStep): boolean {
  return state.step === 1 && (state.phase === "preparing" || state.phase === "finalizing");
}

export function getProgressWidth(state: OnboardingStep): string {
  if (state.step === 0) return "33%";
  if (state.step === 2) return "100%";
  if (state.phase === "basics") return "45%";
  if (state.phase === "install") return "72%";
  return "82%";
}

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
    const token = await window.Clerk?.session?.getToken(attempt > 1 ? { skipCache: true } : undefined);
    if (!token) throw new Error("Unauthorized");

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

    if (res.ok) return;

    const data = await res.json().catch(() => ({}));
    const isRetryable202 = res.status === 202 && data?.retry;
    const isRetryableNotFound =
      res.status === 404 &&
      typeof data?.error === "string" &&
      data.error.toLowerCase().includes("requested organization not found");

    if ((isRetryable202 || isRetryableNotFound) && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(Math.floor(delay * 1.35), 4000);
      continue;
    }

    if (res.status === 202) {
      throw new Error(data?.error || "Sync pending. Your account is currently syncing.");
    }

    throw new Error(data?.error || `HTTP error ${res.status}`);
  }
}

// --- Sync Polling Logic ---

type AuthSyncStatus =
  | { type: "success"; hasOrgs: boolean; needsOnboarding: boolean }
  | { type: "retry"; delay?: number }
  | { type: "error" };

async function checkAuthSyncStatus(): Promise<AuthSyncStatus> {
  try {
    // @ts-expect-error window.Clerk is injected globally by ClerkProvider
    const token = await window.Clerk?.session?.getToken({ skipCache: true });
    if (!token) return { type: "retry" };

    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 202) {
      const syncState = await res.json().catch(() => ({}));
      return { type: "retry", delay: syncState?.retry ? 2000 : undefined };
    }

    if (res.ok) {
      const data = await res.json();
      const hasOrgs = !!data.user?.has_orgs;
      const onboardingStatus = normalizeOnboardingStatus(data.user?.onboarding_status);
      const needsOnboarding = deriveNeedsOnboarding(hasOrgs, onboardingStatus);
      return { type: "success", hasOrgs, needsOnboarding };
    }

    return { type: "retry" };
  } catch {
    return { type: "retry" };
  }
}

type SyncPollingResult =
  | { status: "ready" }
  | { status: "complete" }
  | { status: "timeout" }
  | { status: "cancelled" };

async function pollForOrganizationSync(onCancelCheck: () => boolean): Promise<SyncPollingResult> {
  const maxWait = 30_000;
  const start = Date.now();
  let delay = 500;

  while (Date.now() - start < maxWait) {
    if (onCancelCheck()) return { status: "cancelled" };

    const syncStatus = await checkAuthSyncStatus();

    if (syncStatus.type === "success") {
      if (syncStatus.hasOrgs && syncStatus.needsOnboarding) return { status: "ready" };
      if (!syncStatus.needsOnboarding) return { status: "complete" };
    } else if (syncStatus.type === "retry" && syncStatus.delay) {
      await new Promise((r) => setTimeout(r, syncStatus.delay));
      continue;
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 2000);
  }

  return { status: "timeout" };
}

function useOrganizationSyncEffect(
  setState: React.Dispatch<React.SetStateAction<OnboardingStep>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const resume = sessionStorage.getItem("onboarding_resume");
    if (resume !== "connect-host") return;

    let cancelled = false;

    (async () => {
      const result = await pollForOrganizationSync(() => cancelled);

      if (cancelled) return;

      switch (result.status) {
        case "ready":
          toast({ title: "Organization created", description: "Now connect your first Docker host." });
          setState({ step: 1, phase: "basics" });
          break;
        case "complete":
          sessionStorage.removeItem("onboarding_resume");
          navigate("/app", { replace: true });
          break;
        case "timeout":
          sessionStorage.removeItem("onboarding_resume");
          setState({ step: 0, phase: "form" });
          setError("Organization sync took too long. Please try creating your organization again.");
          break;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingStep>(() =>
    sessionStorage.getItem("onboarding_resume") === "connect-host"
      ? { step: 0, phase: "syncing" }
      : { step: 0, phase: "form" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [testError, setTestError] = useState("");
  const [remediationCommand, setRemediationCommand] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostUrl, setHostUrl] = useState("");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("agent");
  const [socketPath, setSocketPath] = useState("/var/run/docker.sock");
  const [cfServiceTokenId, setCfServiceTokenId] = useState("");
  const [cfServiceTokenSecret, setCfServiceTokenSecret] = useState("");
  const [enrollment, setEnrollment] = useState<AgentEnrollmentCreateResponse | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<AgentEnrollmentFinalizeResponse | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoaded, orgId } = useAuth();
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const fallbackOrgId = userMemberships.data?.[0]?.organization?.id ?? null;

  useEffect(() => {
    if (isLoaded && orgId && state.step === 0 && state.phase === "form") {
      setState({ step: 1, phase: "basics" });
    }
  }, [isLoaded, orgId, state.step, state.phase]);

  useOrganizationSyncEffect(setState, setError);

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

  const createEnrollment = useCallback(async () => {
    const clerkOrgId = orgId ?? fallbackOrgId;
    if (!clerkOrgId) {
      throw new Error("No active organization found. Please refresh the page.");
    }

    const enrollmentResponse = await agentEnrollmentApi.create({
      organizationId: clerkOrgId,
      hostName,
      hostUrl,
      connectionMode,
      dockerSocketPath: socketPath,
      cfServiceTokenId: connectionMode === "cloudflare_tunnel" ? cfServiceTokenId.trim() || undefined : undefined,
      cfServiceTokenSecret: connectionMode === "cloudflare_tunnel" ? cfServiceTokenSecret.trim() || undefined : undefined,
    });

    setEnrollment(enrollmentResponse);
    setRemediationCommand(null);
    setTestError("");
    setError(null);
    setState({ step: 1, phase: "install" });
  }, [orgId, fallbackOrgId, hostName, hostUrl, connectionMode, socketPath, cfServiceTokenId, cfServiceTokenSecret]);

  const handleBasicsNext = useCallback(async () => {
    setError(null);
    if (!hostName.trim()) {
      setError("Host name is required.");
      return;
    }

    try {
      setState({ step: 1, phase: "preparing" });
      await createEnrollment();
    } catch (err) {
      setState({ step: 1, phase: "basics" });
      setError(err instanceof Error ? err.message : "Failed to prepare the guided setup command.");
    }
  }, [hostName, createEnrollment]);

  const handleRegenerateEnrollment = useCallback(async () => {
    try {
      setState({ step: 1, phase: "preparing" });
      await createEnrollment();
      toast({ title: "Fresh setup command ready", description: "A new enrollment command was generated for this host." });
    } catch (err) {
      setState({ step: 1, phase: "install" });
      setError(err instanceof Error ? err.message : "Failed to regenerate the setup command.");
    }
  }, [createEnrollment, toast]);

  const finalizeEnrollment = useCallback(async () => {
    if (!enrollment?.session_id) {
      setError("No enrollment session is active. Generate a setup command first.");
      return;
    }

    if (!hostUrl.trim()) {
      setError("Host URL is required to test the connection.");
      return;
    }

    if (!hostUrl.trim()) {
      setError("Enter a valid IP or hostname (e.g. 192.168.1.5)");
      return;
    }

    setError(null);
    setTestError("");
    setRemediationCommand(null);

    try {
      setState({ step: 1, phase: "finalizing" });
      const result = await agentEnrollmentApi.finalize(enrollment.session_id, hostUrl);
      setFinalizeResult(result);

      if (!result.ok) {
        setTestError(result.status || "Connection test failed.");
        setRemediationCommand(result.remediation_command);
        setState({ step: 1, phase: "test-failed" });
        return;
      }

      const isWarning = result.reason_code === "agent_outdated" || result.reason_code === "metrics_unavailable";
      if (isWarning) {
        toast({
          title: "Host connected with follow-up recommended",
          description:
            result.reason_code === "agent_outdated"
              ? "The host is reachable, but the installed agent is behind the current release."
              : "The host is reachable, but local metrics verification still needs attention.",
        });
      } else {
        toast({ title: "Host connected!", description: `"${hostName}" is verified and ready.` });
      }
      setState({ step: 2, phase: "done" });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Connection test failed.");
      setState({ step: 1, phase: "test-failed" });
    }
  }, [enrollment, hostName, hostUrl, toast]);

  const handleRetryTest = useCallback(async () => {
    await finalizeEnrollment();
  }, [finalizeEnrollment]);

  const handleBackToBasics = useCallback(() => {
    setError(null);
    setState({ step: 1, phase: "basics" });
  }, []);

  return {
    state,
    error,
    isSkipping,
    testError,
    remediationCommand,
    orgName,
    setOrgName,
    handleCreateOrg,
    hostName,
    setHostName,
    hostUrl,
    setHostUrl,
    connectionMode,
    setConnectionMode,
    socketPath,
    setSocketPath,
    cfServiceTokenId,
    setCfServiceTokenId,
    cfServiceTokenSecret,
    setCfServiceTokenSecret,
    enrollment,
    finalizeResult,
    handleBasicsNext,
    handleRetryTest,
    handleBackToBasics,
    handleSkip,
    completeOnboardingAndNavigate,
    handleFinalizeEnrollment: finalizeEnrollment,
    handleRegenerateEnrollment,
  };
}
