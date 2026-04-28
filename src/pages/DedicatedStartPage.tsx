import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { pricingPlans } from "@/lib/pricing";

const enterprisePlan = pricingPlans.find((plan) => plan.id === "enterprise");

const deploymentMilestones = [
  "Architecture brief reviewed",
  "Capacity reserved on isolated infrastructure",
  "Security baseline and access controls applied",
  "Workspace prepared for guided handoff",
];

const trustPoints = [
  { icon: ShieldCheck, label: "Bare-metal isolation" },
  { icon: Database, label: "Dedicated database" },
  { icon: LockKeyhole, label: "SSO-ready identity path" },
  { icon: ServerCog, label: "Managed Hetzner and Proxmox stack" },
];

export default function DedicatedStartPage() {
  const { isSignedIn } = useAuth();
  const primaryHref = isSignedIn ? "/dedicated/intake" : "/sign-up?next=/dedicated/intake";
  const secondaryHref = isSignedIn ? "/app" : "/login?next=/dedicated/intake";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />

      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_42%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-primary">
                Dedicated Deployment
              </p>
              <h1 className="max-w-xl text-4xl font-bold tracking-tight md:text-6xl">
                Private Docker Dash infrastructure, provisioned by our team.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                This is not a shared SaaS checkout. We stand up a managed isolated environment,
                validate the baseline, and hand your team a guided rollout path within 3 to 5
                business days.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={primaryHref}>
                  <Button size="lg" className="w-full gap-2 sm:w-auto">
                    Start Private Deployment
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to={secondaryHref}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    {isSignedIn ? "Back to workspace" : "Sign in to continue"}
                  </Button>
                </Link>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                We review requirements, reserve capacity, and return a deployment reference within
                1 business day.
              </p>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {trustPoints.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * index, duration: 0.45, ease: "easeOut" }}
                    whileHover={{ y: -4 }}
                    className="rounded-3xl border border-border/70 bg-card/60 p-4 backdrop-blur"
                  >
                    <item.icon className="mb-3 h-5 w-5 text-primary" />
                    <div className="text-sm font-medium">{item.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.985, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
              whileHover={{
                y: -6,
                boxShadow: "0 30px 90px -42px hsl(var(--primary) / 0.45)",
              }}
              className="rounded-[2rem] border border-primary/35 bg-card/80 p-6 shadow-[0_30px_90px_-52px_hsl(var(--primary)/0.6)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    {enterprisePlan?.name ?? "Dedicated"}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                    Dedicated (Managed Instance)
                  </h2>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  White-glove
                </span>
              </div>

              <div className="mt-6 rounded-3xl border border-border/70 bg-background/60 p-5">
                <div className="text-sm text-muted-foreground">Deployment window</div>
                <div className="mt-2 text-4xl font-bold tracking-tight">3-5 business days</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Includes provisioning, hardening, validation, and handoff preparation.
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {deploymentMilestones.map((step) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/45 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-dashed border-border/70 p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">Best for regulated or high-trust buyers</div>
                    <div className="text-sm text-muted-foreground">
                      Dedicated hosting, isolated data paths, negotiated allocations, and identity
                      integration.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-3">
            {[
              {
                title: "1. Intake and architecture review",
                body: "You submit deployment requirements. We review regions, compliance scope, SSO expectations, and integration needs before reserving capacity.",
              },
              {
                title: "2. Private environment provisioning",
                body: "We provision isolated infrastructure, apply baseline security controls, and prepare your dedicated workspace rather than dropping you into a shared control plane.",
              },
              {
                title: "3. Guided handoff",
                body: "Once the environment is secured, your team receives a deployment dashboard, rollout checklist, and guided first-host activation path.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.4, delay: 0.08 * index }}
                className="rounded-[1.75rem] border border-border/70 bg-card/60 p-6"
              >
                <div className="text-lg font-semibold tracking-tight">{item.title}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
