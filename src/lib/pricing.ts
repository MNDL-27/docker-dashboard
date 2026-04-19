export type PlanId = "free" | "pro" | "team" | "enterprise";

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
    summary: "Validate the platform on one connected node with strict limits on storage, scans, and integrations so infrastructure growth creates a clear upgrade point.",
    supportLabel: "Community and self-serve docs",
    sloLabel: "Best effort only",
    highlights: [
      "1 connected node",
      "1 operator seat",
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
    priceLabel: "$29/mo",
    monthlyPrice: 29,
    audience: "Solo developers managing a few remote environments.",
    summary: "Built for individual operators who need more nodes, more history, and reliable alert delivery without paying for team administration.",
    supportLabel: "Email support",
    sloLabel: "1 business day response target",
    highlights: [
      "Up to 5 nodes",
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
    summary: "This is the primary commercial tier for teams that need collaboration, long retention, premium integrations, and room to expand with extra node packs.",
    supportLabel: "Priority support",
    sloLabel: "4 business hour response target",
    highlights: [
      "15 to 25 nodes",
      "Continuous scanning and real-time alerting",
      "1 year of retention",
      "Up to 10 seats with RBAC",
    ],
    restrictions: [
      "Additional node packs sold separately",
      "Premium integrations include AWS ECR, Slack, PagerDuty, and scheduled PDF reports",
      "Best fit for commercial auditing and client-facing reporting",
    ],
    ctaLabel: "Choose Business",
  },
  {
    id: "enterprise",
    name: "Dedicated",
    priceLabel: "Custom",
    monthlyPrice: null,
    audience: "Managed, isolated infrastructure for high-trust customers.",
    summary: "Use this when the customer needs dedicated hosting, isolated data, negotiated allocations, and identity integration on infrastructure you manage for them.",
    supportLabel: "Named support path",
    sloLabel: "Custom SLA/SLO",
    highlights: [
      "Custom nodes and scan allocations",
      "Isolated database and dedicated compute",
      "Unlimited organization seats",
      "SSO integration",
    ],
    restrictions: [
      "Contract and infrastructure dependent",
      "Provisioned per customer environment",
      "Not self-serve",
    ],
    ctaLabel: "Contact Sales",
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
    label: "Node allowance",
    values: {
      free: "1 node",
      pro: "Up to 5 nodes",
      team: "15 to 25 nodes",
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
      free: "1 seat",
      pro: "1 seat",
      team: "Up to 10 seats with RBAC",
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
      free: "Single-node proof tier",
      pro: "Individual operator only",
      team: "Extra capacity via node packs",
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
