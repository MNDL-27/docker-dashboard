import { STEPS, getProgressWidth, isStep0Submitting, isStep1Loading, useOnboardingState } from "./onboarding/useOnboardingState";
import { StepCreateOrg } from "./onboarding/StepCreateOrg";
import { StepHostBasics } from "./onboarding/StepHostBasics";
import { StepHostCredentials } from "./onboarding/StepHostCredentials";
import { StepTestFailed } from "./onboarding/StepTestFailed";
import { StepComplete } from "./onboarding/StepComplete";
import { LoadingCard } from "./onboarding/LoadingCard";

export default function OnboardingPage() {
  const ob = useOnboardingState();
  const { state } = ob;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OnboardingHeader stepIndex={state.step} progressWidth={getProgressWidth(state)} />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className={`w-full ${state.step === 1 ? "max-w-2xl" : "max-w-md"}`}>
          <OnboardingStepRouter ob={ob} />
        </div>
      </main>
    </div>
  );
}

function OnboardingHeader({ stepIndex, progressWidth }: { stepIndex: number; progressWidth: string }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="w-full flex items-center justify-between px-6 py-4">
        <span className="text-sm font-medium text-muted-foreground">Onboarding</span>
        <span className="text-sm font-medium text-foreground">
          Step {stepIndex + 1} of {STEPS.length} - {STEPS[stepIndex]}
        </span>
      </div>
      <div className="w-full h-1 bg-border">
        <div className="h-full bg-primary transition-all duration-500 ease-in-out" style={{ width: progressWidth }} />
      </div>
    </header>
  );
}

function OnboardingStepRouter({ ob }: { ob: ReturnType<typeof useOnboardingState> }) {
  const { state } = ob;

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

  if (isStep0Submitting(state)) {
    const title = state.phase === "creating" ? "Creating organization..." : "Syncing your workspace...";
    const desc = state.phase === "creating"
      ? `Setting up "${ob.orgName.trim()}"...`
      : "Finishing setup. This usually takes a few seconds.";
    return <LoadingCard title={title} description={desc} />;
  }

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

  if (state.step === 1 && state.phase === "install") {
    return (
      <StepHostCredentials
        connectionMode={ob.connectionMode}
        modeLabel={ob.enrollment?.mode_label || ""}
        installCommand={ob.enrollment?.install_command || ""}
        verifyCommand={ob.enrollment?.verify_command || ""}
        setupSummary={ob.enrollment?.setup_summary || ""}
        verifySummary={ob.enrollment?.verify_summary || ""}
        nextStepSummary={ob.enrollment?.next_step_summary || ""}
        advancedManualCommand={ob.enrollment?.advanced_manual_command || ""}
        expiresAt={ob.enrollment?.expires_at || null}
        error={ob.error}
        onBack={ob.handleBackToBasics}
        onFinalize={ob.handleFinalizeEnrollment}
        onRegenerate={ob.handleRegenerateEnrollment}
      />
    );
  }

  if (isStep1Loading(state)) {
    const title = state.phase === "preparing" ? "Preparing setup command..." : "Finishing setup...";
    const desc = state.phase === "preparing"
      ? `Creating a guided install command for "${ob.hostName}"...`
      : "Testing the saved host through the Dockerdash proxy path. This may take a moment.";
    return <LoadingCard title={title} description={desc} />;
  }

  if (state.step === 1 && state.phase === "test-failed") {
    return (
      <StepTestFailed
        hostName={ob.hostName}
        testError={ob.testError}
        remediationCommand={ob.remediationCommand}
        onRetry={ob.handleRetryTest}
        onFinishLater={ob.completeOnboardingAndNavigate}
      />
    );
  }

  if (state.step === 2) {
    return <StepComplete onContinue={ob.completeOnboardingAndNavigate} />;
  }

  return null;
}
