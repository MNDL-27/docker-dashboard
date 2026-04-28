import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DEDICATED_STEPS, useDedicatedIntakeState } from "@/hooks/useDedicatedDeployment";
import type { ComplianceNeed, DedicatedRegion, IntegrationNeed } from "@/types/dedicated";

const REGION_OPTIONS: Array<{ value: DedicatedRegion; label: string }> = [
  { value: "eu-central", label: "EU Central" },
  { value: "eu-west", label: "EU West" },
  { value: "us-east", label: "US East" },
  { value: "us-west", label: "US West" },
  { value: "ap-south", label: "AP South" },
  { value: "custom", label: "Custom" },
];

const COMPLIANCE_OPTIONS: Array<{ value: ComplianceNeed; label: string }> = [
  { value: "soc2", label: "SOC 2" },
  { value: "iso27001", label: "ISO 27001" },
  { value: "gdpr", label: "GDPR" },
  { value: "data_residency", label: "Data residency" },
];

const INTEGRATION_OPTIONS: Array<{ value: IntegrationNeed; label: string }> = [
  { value: "aws_ecr", label: "AWS ECR" },
  { value: "slack", label: "Slack alerts" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "email", label: "Email notifications" },
  { value: "pdf_reports", label: "Scheduled PDF reports" },
  { value: "webhooks", label: "Custom webhooks" },
  { value: "sso", label: "SSO / identity integration" },
];

const STEP_LABELS = [
  { id: "scope", label: "Scope", kicker: "Company, timing, and host envelope" },
  { id: "infrastructure", label: "Infrastructure", kicker: "Region, network, and exposure model" },
  { id: "security", label: "Security", kicker: "Compliance and retention requirements" },
  { id: "integrations", label: "Integrations", kicker: "Alerting and workflow connections" },
  { id: "readiness", label: "Readiness", kicker: "Operators, ownership, and blockers" },
  { id: "review", label: "Review", kicker: "Confirm the deployment brief" },
];

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={title}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </motion.div>
  );
}

function Fieldset({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {children}
    </div>
  );
}

export default function DedicatedIntakePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast } = useToast();
  const { state, stepIndex, updateField, toggleArrayValue, nextStep, previousStep, submit } =
    useDedicatedIntakeState();

  const currentStepConfig = STEP_LABELS[Math.min(stepIndex, STEP_LABELS.length - 1)];
  const progressValue = Math.round(((Math.min(stepIndex, STEP_LABELS.length - 1) + 1) / STEP_LABELS.length) * 100);
  const summaryRows = useMemo(
    () => [
      { label: "Go-live window", value: state.data.targetGoLiveWindow.replaceAll("_", " ") },
      { label: "Host range", value: state.data.estimatedNodeRange.replaceAll("_", " to ") },
      { label: "Preferred region", value: state.data.preferredRegion.replaceAll("-", " ") },
      { label: "Seat estimate", value: `${state.data.operatorSeatEstimate} operators` },
    ],
    [state.data],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!state.data.primaryContactName && user.fullName) {
      updateField("primaryContactName", user.fullName);
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!state.data.primaryContactEmail && email) {
      updateField("primaryContactEmail", email);
    }
  }, [state.data.primaryContactEmail, state.data.primaryContactName, updateField, user]);

  const handleSubmit = async () => {
    try {
      const record = await submit();
      toast({
        title: "Deployment brief received",
        description: `Reference ${record.reference_id} is now in the provisioning queue.`,
      });
      navigate("/app/dedicated-deployment", { replace: true });
    } catch (error) {
      toast({
        title: "Could not submit deployment brief",
        description: error instanceof Error ? error.message : "Please retry in a moment.",
        variant: "destructive",
      });
    }
  };

  const isReviewStep = state.step === "review";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Dedicated Deployment Intake
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Build the deployment brief before we reserve infrastructure.
            </h1>
          </div>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Back to pricing
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-5">
          <div className="h-1 overflow-hidden rounded-full bg-border/70">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-border/70 bg-card/70 p-6 shadow-[0_24px_70px_-55px_black]">
          <div className="mb-8 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {STEP_LABELS.map((step, index) => {
              const isActive = index === Math.min(stepIndex, STEP_LABELS.length - 1);
              const isDone = index < stepIndex;

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-3 py-3 ${
                    isActive
                      ? "border-primary/50 bg-primary/10"
                      : isDone
                        ? "border-border/70 bg-background/70"
                        : "border-border/50 bg-background/35"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    ) : isActive ? (
                      <Circle className="h-3.5 w-3.5 fill-primary text-primary" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                    Step {index + 1}
                  </div>
                  <div className="mt-3 text-sm font-medium">{step.label}</div>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {state.step === "scope" ? (
              <StepShell
                title="Frame the rollout"
                description="Start with the buyer, the operating window, and the rough deployment size. This gives us enough to reserve the right envelope before we discuss deeper infrastructure details."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Fieldset label="Company name">
                    <Input
                      value={state.data.companyName}
                      onChange={(event) => updateField("companyName", event.target.value)}
                      placeholder="Example: Northwind Security"
                    />
                  </Fieldset>
                  <Fieldset label="Buyer role">
                    <Input
                      value={state.data.buyerRole}
                      onChange={(event) => updateField("buyerRole", event.target.value)}
                      placeholder="VP Engineering, DevOps Lead, Founder..."
                    />
                  </Fieldset>
                  <Fieldset label="Primary contact">
                    <Input
                      value={state.data.primaryContactName}
                      onChange={(event) => updateField("primaryContactName", event.target.value)}
                      placeholder="Your name"
                    />
                  </Fieldset>
                  <Fieldset label="Primary contact email">
                    <Input
                      type="email"
                      value={state.data.primaryContactEmail}
                      onChange={(event) => updateField("primaryContactEmail", event.target.value)}
                      placeholder="name@company.com"
                    />
                  </Fieldset>
                  <Fieldset label="Target go-live window">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={state.data.targetGoLiveWindow}
                      onChange={(event) =>
                        updateField("targetGoLiveWindow", event.target.value as typeof state.data.targetGoLiveWindow)
                      }
                    >
                      <option value="asap">ASAP</option>
                      <option value="2_weeks">Within 2 weeks</option>
                      <option value="30_days">Within 30 days</option>
                      <option value="custom">Custom window</option>
                    </select>
                  </Fieldset>
                  <Fieldset label="Estimated host range">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={state.data.estimatedNodeRange}
                      onChange={(event) =>
                        updateField("estimatedNodeRange", event.target.value as typeof state.data.estimatedNodeRange)
                      }
                    >
                      <option value="1_5">1 to 5 hosts</option>
                      <option value="6_15">6 to 15 hosts</option>
                      <option value="16_25">16 to 25 hosts</option>
                      <option value="26_plus">26 plus hosts</option>
                    </select>
                  </Fieldset>
                  <Fieldset label="Environment count">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={state.data.environmentCount}
                      onChange={(event) => updateField("environmentCount", Number(event.target.value || 1))}
                    />
                  </Fieldset>
                  <Fieldset label="Operator seat estimate">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={state.data.operatorSeatEstimate}
                      onChange={(event) => updateField("operatorSeatEstimate", Number(event.target.value || 1))}
                    />
                  </Fieldset>
                </div>
              </StepShell>
            ) : null}

            {state.step === "infrastructure" ? (
              <StepShell
                title="Define the infrastructure envelope"
                description="Capture region placement, networking needs, and exposure expectations. This is the input that changes how the managed instance is physically shaped."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Fieldset label="Preferred region">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={state.data.preferredRegion}
                      onChange={(event) =>
                        updateField("preferredRegion", event.target.value as typeof state.data.preferredRegion)
                      }
                    >
                      {REGION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Fieldset>

                  <Fieldset label="Secondary regions">
                    <div className="grid gap-2 rounded-2xl border border-border/70 p-4">
                      {REGION_OPTIONS.filter((option) => option.value !== state.data.preferredRegion).map((option) => (
                        <label key={option.value} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={state.data.secondaryRegions.includes(option.value)}
                            onCheckedChange={() => toggleArrayValue("secondaryRegions", option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </Fieldset>

                  <Fieldset label="Dedicated domain required?">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant={state.data.needsCustomDomain ? "default" : "outline"}
                        onClick={() => updateField("needsCustomDomain", true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={!state.data.needsCustomDomain ? "default" : "outline"}
                        onClick={() => updateField("needsCustomDomain", false)}
                      >
                        No
                      </Button>
                    </div>
                  </Fieldset>

                  <Fieldset label="Private networking required?">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant={state.data.needsPrivateNetworking ? "default" : "outline"}
                        onClick={() => updateField("needsPrivateNetworking", true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={!state.data.needsPrivateNetworking ? "default" : "outline"}
                        onClick={() => updateField("needsPrivateNetworking", false)}
                      >
                        No
                      </Button>
                    </div>
                  </Fieldset>

                  <div className="md:col-span-2">
                    <Fieldset label="Rollout notes" description="Capture networking assumptions, host segmentation, or any environment-specific constraints we should know before provisioning.">
                      <Textarea
                        value={state.data.rolloutNotes}
                        onChange={(event) => updateField("rolloutNotes", event.target.value)}
                        placeholder="Example: production hosts must stay in EU Central, staging can live separately, secure tunnel ownership sits with internal platform team..."
                        rows={5}
                      />
                    </Fieldset>
                  </div>
                </div>
              </StepShell>
            ) : null}

            {state.step === "security" ? (
              <StepShell
                title="Capture security and compliance requirements"
                description="This turns the waiting period into useful operator work. We can provision faster when the compliance posture and retention expectations are explicit up front."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Fieldset label="Compliance scope">
                    <div className="grid gap-2 rounded-2xl border border-border/70 p-4">
                      {COMPLIANCE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={state.data.complianceNeeds.includes(option.value)}
                            onCheckedChange={() => toggleArrayValue("complianceNeeds", option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </Fieldset>

                  <Fieldset label="Retention requirement (days)">
                    <Input
                      type="number"
                      min={7}
                      value={state.data.retentionRequirementDays ?? ""}
                      onChange={(event) =>
                        updateField(
                          "retentionRequirementDays",
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                    />
                  </Fieldset>

                  <Fieldset label="SSO required?">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant={state.data.requiresSSO ? "default" : "outline"}
                        onClick={() => updateField("requiresSSO", true)}
                      >
                        Required
                      </Button>
                      <Button
                        type="button"
                        variant={!state.data.requiresSSO ? "default" : "outline"}
                        onClick={() => updateField("requiresSSO", false)}
                      >
                        Not initially
                      </Button>
                    </div>
                  </Fieldset>

                  <Fieldset label="Existing agent rollout in place?">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant={state.data.hasExistingDockerAgentRollout ? "default" : "outline"}
                        onClick={() => updateField("hasExistingDockerAgentRollout", true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={!state.data.hasExistingDockerAgentRollout ? "default" : "outline"}
                        onClick={() => updateField("hasExistingDockerAgentRollout", false)}
                      >
                        No
                      </Button>
                    </div>
                  </Fieldset>
                </div>
              </StepShell>
            ) : null}

            {state.step === "integrations" ? (
              <StepShell
                title="Choose the initial workflow integrations"
                description="These selections do not permanently lock the deployment. They tell us what should be ready or documented at handoff."
              >
                <div className="grid gap-2 rounded-3xl border border-border/70 p-5">
                  {INTEGRATION_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 hover:border-border/70 hover:bg-background/60"
                    >
                      <Checkbox
                        checked={state.data.integrations.includes(option.value)}
                        onCheckedChange={() => toggleArrayValue("integrations", option.value)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </StepShell>
            ) : null}

            {state.step === "readiness" ? (
              <StepShell
                title="Confirm operational ownership"
                description="We need one buyer contact and one technical owner to keep the rollout moving. Capture any blockers now so they become part of the handoff plan instead of a surprise."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Fieldset label="Technical owner name">
                    <Input
                      value={state.data.technicalOwnerName}
                      onChange={(event) => updateField("technicalOwnerName", event.target.value)}
                      placeholder="Platform or DevOps owner"
                    />
                  </Fieldset>
                  <Fieldset label="Technical owner email">
                    <Input
                      type="email"
                      value={state.data.technicalOwnerEmail}
                      onChange={(event) => updateField("technicalOwnerEmail", event.target.value)}
                      placeholder="devops@company.com"
                    />
                  </Fieldset>
                  <div className="md:col-span-2">
                    <Fieldset label="Known blockers">
                      <Textarea
                        value={state.data.blockers}
                        onChange={(event) => updateField("blockers", event.target.value)}
                        placeholder="Example: SSO metadata is owned by security team, DNS approval takes 2 days, first host list still being finalized..."
                        rows={5}
                      />
                    </Fieldset>
                  </div>
                </div>
              </StepShell>
            ) : null}

            {state.step === "review" ? (
              <StepShell
                title="Review the deployment brief"
                description="This is the exact operating brief the provisioning queue will receive. Once submitted, we generate a deployment reference and move you into the managed status dashboard."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["Company", state.data.companyName || "Not provided"],
                    ["Primary contact", `${state.data.primaryContactName || "Not provided"}${state.data.primaryContactEmail ? ` • ${state.data.primaryContactEmail}` : ""}`],
                    ["Go-live", state.data.targetGoLiveWindow.replaceAll("_", " ")],
                    ["Host range", state.data.estimatedNodeRange.replaceAll("_", " to ")],
                    ["Region", state.data.preferredRegion.replaceAll("-", " ")],
                    ["Compliance", state.data.complianceNeeds.length ? state.data.complianceNeeds.join(", ") : "None selected"],
                    ["Integrations", state.data.integrations.length ? state.data.integrations.join(", ") : "None selected"],
                    ["Technical owner", `${state.data.technicalOwnerName || "Not provided"}${state.data.technicalOwnerEmail ? ` • ${state.data.technicalOwnerEmail}` : ""}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-2 text-sm leading-6">{value}</div>
                    </div>
                  ))}
                </div>

                {state.submitError ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {state.submitError}
                  </div>
                ) : null}
              </StepShell>
            ) : null}
          </AnimatePresence>

          <div className="mt-8 flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={previousStep} disabled={stepIndex === 0 || state.isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex flex-col items-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/pricing")}
                disabled={state.isSubmitting}
              >
                Save for later
              </Button>
              {isReviewStep ? (
                <Button type="button" onClick={handleSubmit} disabled={state.isSubmitting}>
                  {state.isSubmitting ? "Submitting..." : "Submit deployment brief"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={nextStep} disabled={state.isSubmitting}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.75rem] border border-primary/25 bg-primary/8 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Active deployment summary
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {currentStepConfig.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {currentStepConfig.kicker}
            </p>

            <div className="mt-6 space-y-3">
              {summaryRows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-border/60 bg-background/55 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {row.label}
                  </div>
                  <div className="mt-2 text-sm capitalize">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div className="font-medium">What happens after submission</div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>We generate a deployment reference and return you to a live provisioning dashboard.</p>
              <p>Within 1 business day, you receive your first operator update and any technical homework for the handoff window.</p>
              <p>The deployment dashboard stays visible until the environment is ready for guided activation.</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div className="font-medium">Why this is different from self-serve</div>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Dedicated infrastructure is provisioned per customer environment.</li>
              <li>Provisioning time is spent on isolation, hardening, and operational readiness.</li>
              <li>You do not enter the standard host-onboarding wizard until the environment is secured.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
