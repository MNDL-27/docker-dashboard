import { PLAN_POLICY_BY_PLAN, type PlanId } from "../../shared/schema/plan-policy.ts";

export interface PricingPlan {
  id: PlanId;
  name: string;
  priceLabel: string;
  monthlyPrice: number | null;
  audience: string;
  summary: string;
  supportLabel: string;
  sloLabel: string;
  highlights: string[];
  restrictions: string[];
  ctaLabel: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    monthlyPrice: 0,
    audience: "Proof-of-value for a single small environment.",
    summary: "Validate the platform on one connected host with strict limits on storage, scans, and integrations so infrastructure growth creates a clear upgrade point.",
    supportLabel: "Community and self-serve docs",
    sloLabel: "Best effort only",
    highlights: [
      `${PLAN_POLICY_BY_PLAN.free.nodeLimit} connected host`,
      `${PLAN_POLICY_BY_PLAN.free.seatLimit} operator seat`,
      "100 scans per month",
      "7 days of log history",
    ],
    restrictions: [
      "In-app notifications only",
      "No team collaboration features",
      "Designed for basic single-server evaluation",
    ],
    ctaLabel: "Start Free",
  },
  {
    id: "pro",
    name: "Individual",
    priceLabel: "$24/mo",
    monthlyPrice: 24,
    audience: "Solo developers managing a few remote environments.",
    summary: "Built for individual operators who need more hosts, more history, and reliable alert delivery without paying for team administration.",
    supportLabel: "Email support",
    sloLabel: "1 business day response target",
    highlights: [
      `Up to ${PLAN_POLICY_BY_PLAN.pro.nodeLimit} hosts`,
      "Unlimited manual scans",
      "Automated hourly checks",
      "30 days of history",
    ],
    restrictions: [
      "1 seat only",
      "Basic webhooks, Discord, and email alerts",
      "No team collaboration or managed isolation",
    ],
    ctaLabel: "Choose Individual",
  },
  {
    id: "team",
    name: "Business",
    priceLabel: "$79/mo",
    monthlyPrice: 79,
    audience: "Small businesses and agencies managing client or internal fleets.",
    summary: "This is the primary commercial tier for teams that need collaboration, long retention, premium integrations, and room to expand with extra host packs.",
    supportLabel: "Priority support",
    sloLabel: "4 business hour response target",
    highlights: [
      `Up to ${PLAN_POLICY_BY_PLAN.team.nodeLimit} hosts`,
      "Continuous scanning and real-time alerting",
      "1 year of retention",
      `Up to ${PLAN_POLICY_BY_PLAN.team.seatLimit} seats with RBAC`,
    ],
    restrictions: [
      "Additional host packs sold separately",
      "Premium integrations include AWS ECR, Slack, PagerDuty, and scheduled PDF reports",
      "Best fit for commercial auditing and client-facing reporting",
    ],
    ctaLabel: "Choose Business",
  },
  {
    id: "enterprise",
    name: "Dedicated",
    priceLabel: "From $500/mo",
    monthlyPrice: null,
    audience: "Managed, isolated infrastructure for high-trust customers.",
    summary: "Use this when the customer needs dedicated hosting, isolated data, negotiated allocations, and identity integration on infrastructure you manage for them.",
    supportLabel: "Named support path",
    sloLabel: "Custom SLA/SLO",
    highlights: [
      "Custom hosts and scan allocations",
      "Isolated database and dedicated compute",
      "Unlimited organization seats",
      "SSO integration",
    ],
    restrictions: [
      "Contract and infrastructure dependent",
      "Provisioned per customer environment",
      "Not self-serve",
    ],
    ctaLabel: "Start Private Deployment",
  },
];

export const pricingComparisonRows = [
  {
    label: "Best for",
    values: {
      free: "Proving the product on one small environment",
      pro: "A solo developer with a few VPS or project stacks",
      team: "A small business or agency with shared operational ownership",
      enterprise: "Customers needing managed dedicated infrastructure",
    },
  },
  {
    label: "Host allowance",
    values: {
      free: `${PLAN_POLICY_BY_PLAN.free.nodeLimit} host`,
      pro: `Up to ${PLAN_POLICY_BY_PLAN.pro.nodeLimit} hosts`,
      team: `Up to ${PLAN_POLICY_BY_PLAN.team.nodeLimit} hosts`,
      enterprise: "Custom",
    },
  },
  {
    label: "Scan frequency",
    values: {
      free: "100 scans per month",
      pro: "Unlimited manual plus automated hourly checks",
      team: "Continuous scanning with real-time alerting",
      enterprise: "Contract-defined",
    },
  },
  {
    label: "Log viewer depth",
    values: {
      free: `${PLAN_POLICY_BY_PLAN.free.logTailLines} lines per request`,
      pro: `${PLAN_POLICY_BY_PLAN.pro.logTailLines.toLocaleString()} lines per request`,
      team: `${PLAN_POLICY_BY_PLAN.team.logTailLines.toLocaleString()} lines per request`,
      enterprise: "Custom",
    },
  },
  {
    label: "Retention",
    values: {
      free: "7 days",
      pro: "30 days",
      team: "1 year",
      enterprise: "Contract-defined",
    },
  },
  {
    label: "Seats",
    values: {
      free: `${PLAN_POLICY_BY_PLAN.free.seatLimit} seat`,
      pro: `${PLAN_POLICY_BY_PLAN.pro.seatLimit} seat`,
      team: `Up to ${PLAN_POLICY_BY_PLAN.team.seatLimit} seats with RBAC`,
      enterprise: "Unlimited with SSO",
    },
  },
  {
    label: "Integrations",
    values: {
      free: "In-app notifications",
      pro: "Discord, email, and basic webhooks",
      team: "AWS ECR, Slack, PagerDuty, PDF reports",
      enterprise: "Custom and contract-defined",
    },
  },
  {
    label: "Support / SLO",
    values: {
      free: "Best effort only",
      pro: "Email support, 1 business day",
      team: "Priority support, 4 business hours",
      enterprise: "Named support path, custom SLA/SLO",
    },
  },
  {
    label: "Commercial restrictions",
    values: {
      free: "Single-host proof tier",
      pro: "Individual operator only",
      team: "Extra capacity via host packs",
      enterprise: "Dedicated managed instance",
    },
  },
];

export function getPricingPlan(planId: PlanId) {
  return pricingPlans.find((plan) => plan.id === planId);
}

export function getCheckoutPriceId(planId: Extract<PlanId, "pro" | "team">) {
  if (planId === "pro") {
    return import.meta.env.VITE_PADDLE_LAUNCH_PRICE_ID || import.meta.env.VITE_PADDLE_PRO_PRICE_ID || "";
  }

  return import.meta.env.VITE_PADDLE_SCALE_PRICE_ID || import.meta.env.VITE_PADDLE_TEAM_PRICE_ID || "";
}
