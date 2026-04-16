import { STEPS, getProgressWidth, isStep0Submitting, isStep1Loading, useOnboardingState } from "./onboarding/useOnboardingState";
import { StepCreateOrg } from "./onboarding/StepCreateOrg";
import { StepHostBasics } from "./onboarding/StepHostBasics";
import { StepHostCredentials } from "./onboarding/StepHostCredentials";
import { StepTestFailed } from "./onboarding/StepTestFailed";
import { StepComplete } from "./onboarding/StepComplete";
import { LoadingCard } from "./onboarding/LoadingCard";

/* ══════════════════════════════════════════════════════════════════════
    OnboardingPage — Thin orchestrator that delegates to step components
   ══════════════════════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const ob = useOnboardingState();
  const { state } = ob;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Header Bar ── */}
      <OnboardingHeader stepIndex={state.step} progressWidth={getProgressWidth(state)} />

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className={`w-full ${state.step === 1 ? "max-w-lg" : "max-w-md"}`}>
          <OnboardingStepRouter ob={ob} />
        </div>
      </main>
    </div>
  );
}

/* ── Header with progress bar ── */
function OnboardingHeader({ stepIndex, progressWidth }: { stepIndex: number; progressWidth: string }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Onboarding</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex]}
          </span>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="w-full h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: progressWidth }}
        />
      </div>
    </header>
  );
}

/* ── Step Router — maps state to the correct sub-component ── */
function OnboardingStepRouter({ ob }: { ob: ReturnType<typeof useOnboardingState> }) {
  const { state } = ob;

  // Step 0: Org form
  if (state.step === 0 && state.phase === "form") {
    return (
      <StepCreateOrg
        orgName={ob.orgName}
        onOrgNameChange={ob.setOrgName}
        onSubmit={ob.handleCreateOrg}
        error={ob.error}
      />
    );
  }

  // Step 0: Creating / Syncing
  if (isStep0Submitting(state)) {
    const title = state.phase === "creating" ? "Creating organization…" : "Syncing your workspace…";
    const desc = state.phase === "creating"
      ? `Setting up "${ob.orgName.trim()}"…`
      : "Finishing setup. This usually takes a few seconds.";
    return <LoadingCard title={title} description={desc} />;
  }

  // Step 1, Screen A: Host basics
  if (state.step === 1 && state.phase === "basics") {
    return (
      <StepHostBasics
        hostName={ob.hostName}
        onHostNameChange={ob.setHostName}
        hostUrl={ob.hostUrl}
        onHostUrlChange={ob.setHostUrl}
        connectionMode={ob.connectionMode}
        onConnectionModeChange={ob.setConnectionMode}
        error={ob.error}
        isSkipping={ob.isSkipping}
        onNext={ob.handleBasicsNext}
        onSkip={ob.handleSkip}
      />
    );
  }

  // Step 1, Screen B: Credentials
  if (state.step === 1 && state.phase === "credentials") {
    return (
      <StepHostCredentials
        connectionMode={ob.connectionMode}
        agentApiKey={ob.agentApiKey}
        onAgentApiKeyChange={ob.setAgentApiKey}
        socketPath={ob.socketPath}
        onSocketPathChange={ob.setSocketPath}
        cfServiceTokenId={ob.cfServiceTokenId}
        onCfServiceTokenIdChange={ob.setCfServiceTokenId}
        cfServiceTokenSecret={ob.cfServiceTokenSecret}
        onCfServiceTokenSecretChange={ob.setCfServiceTokenSecret}
        error={ob.error}
        onBack={ob.handleBackToBasics}
        onSubmit={ob.handleSaveAndTest}
      />
    );
  }

  // Step 1: Saving / Testing
  if (isStep1Loading(state)) {
    const title = state.phase === "saving" ? "Adding host…" : "Testing connection…";
    const desc = state.phase === "saving"
      ? `Saving "${ob.hostName}" to your workspace…`
      : "Verifying Docker API connectivity. This may take a moment.";
    return <LoadingCard title={title} description={desc} />;
  }

  // Step 1: Test failed
  if (state.step === 1 && state.phase === "test-failed") {
    return (
      <StepTestFailed
        hostName={ob.hostName}
        testError={ob.testError}
        onRetry={ob.handleRetryTest}
        onFinishLater={ob.completeOnboardingAndNavigate}
      />
    );
  }

  // Step 2: Success
  if (state.step === 2) {
    return <StepComplete onContinue={ob.completeOnboardingAndNavigate} />;
  }

  return null;
}
