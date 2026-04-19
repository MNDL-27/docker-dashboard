import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock3, Mail, Rocket, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useDedicatedDeployment } from "@/hooks/useDedicatedDeployment";
import { useViewerState } from "@/hooks/useViewerState";
import type { DedicatedDeploymentStatus } from "@/types/dedicated";

const STATUS_ORDER: DedicatedDeploymentStatus[] = [
  "intake_received",
  "capacity_reserved",
  "provisioning",
  "hardening",
  "ready_for_handoff",
];

const STATUS_COPY: Record<
  DedicatedDeploymentStatus,
  { label: string; detail: string }
> = {
  intake_received: {
    label: "Deployment brief accepted",
    detail: "The provisioning queue has your infrastructure brief and is validating the operating envelope.",
  },
  capacity_reserved: {
    label: "Capacity reserved",
    detail: "Dedicated capacity is being assigned for your isolated environment before provisioning begins.",
  },
  provisioning: {
    label: "Infrastructure provisioning",
    detail: "Compute, networking, and the dedicated data path are being provisioned for your organization.",
  },
  hardening: {
    label: "Security hardening",
    detail: "Baseline security controls, access boundaries, and readiness checks are being applied.",
  },
  ready_for_handoff: {
    label: "Workspace handoff ready",
    detail: "The managed environment is secured and ready for guided activation inside the product.",
  },
  active: {
    label: "Dedicated environment active",
    detail: "Provisioning is complete and the organization can operate normally inside Docker Dash.",
  },
};

export default function DedicatedDeploymentPage() {
  const { data: viewer } = useViewerState();
  const { data: deployment, isLoading } = useDedicatedDeployment();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Dedicated Deployment"
          description="No managed deployment brief has been submitted yet."
          breadcrumbs={[{ label: "Management" }, { label: "Dedicated deployment" }]}
        />

        <div className="rounded-[2rem] border border-border/70 bg-card/70 p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Start the managed intake</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Dedicated environments are provisioned through an intake brief rather than the normal
            self-serve checkout flow. Once submitted, this page becomes your deployment status
            dashboard.
          </p>
          <div className="mt-6">
            <Link to="/dedicated/intake">
              <Button>Open deployment intake</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeIndex =
    deployment.status === "active"
      ? STATUS_ORDER.length - 1
      : Math.max(STATUS_ORDER.indexOf(deployment.status), 0);
  const activeCopy = STATUS_COPY[deployment.status];
  const canLaunchOnboarding = deployment.status === "ready_for_handoff" || deployment.status === "active";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dedicated Deployment"
        description="Follow the managed provisioning milestones while your isolated environment is prepared."
        breadcrumbs={[{ label: "Management" }, { label: "Dedicated deployment" }]}
        actions={
          canLaunchOnboarding ? (
            <Link to={deployment.status === "active" ? "/app" : "/onboarding"}>
              <Button>{deployment.status === "active" ? "Open workspace" : "Begin guided activation"}</Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/8 via-card/90 to-card/70 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Deployment reference
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{deployment.reference_id}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {activeCopy.detail}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Expected window
              </div>
              <div className="mt-2 font-medium">{deployment.target_window_label}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {STATUS_ORDER.map((status, index) => {
              const copy = STATUS_COPY[status];
              const isDone = index < activeIndex || deployment.status === "active";
              const isActive = status === deployment.status || (deployment.status === "active" && status === "ready_for_handoff");

              return (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * index, duration: 0.32 }}
                  className={`rounded-[1.35rem] border p-4 ${
                    isActive
                      ? "border-primary/50 bg-primary/10 shadow-[0_18px_50px_-36px_hsl(var(--primary)/0.8)]"
                      : isDone
                        ? "border-border/70 bg-background/60"
                        : "border-border/60 bg-background/30"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : isActive ? (
                      <Clock3 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60" />
                    )}
                    Stage {index + 1}
                  </div>
                  <div className="mt-3 text-sm font-medium">{copy.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Latest operator update</div>
                <div className="text-sm text-muted-foreground">
                  {deployment.latest_update_at
                    ? new Date(deployment.latest_update_at).toLocaleString()
                    : "Awaiting first update"}
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{deployment.latest_update_note}</p>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-6">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-primary" />
              <div className="font-medium">What your team can do now</div>
            </div>

            <div className="mt-4 space-y-3">
              {deployment.checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/55 px-4 py-3">
                  {item.completed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/70 p-6">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div className="font-medium">Support path</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Primary contact: {viewer?.email ?? "Signed-in user"}.
              {canLaunchOnboarding
                ? " Your environment is ready for guided activation."
                : " You will receive additional provisioning updates during the white-glove rollout window."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {canLaunchOnboarding ? (
                <Link to="/onboarding">
                  <Button>Start first host activation</Button>
                </Link>
              ) : (
                <Link to="/app/help">
                  <Button variant="outline">View support options</Button>
                </Link>
              )}
              <Link to="/app/billing">
                <Button variant="ghost">Billing context</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
