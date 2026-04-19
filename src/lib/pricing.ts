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
    audience: "Homelabs, evaluation, and very small setups.",
    summary: "Connect a couple of hosts, inspect containers, and validate the workflow before moving to a paid plan.",
    supportLabel: "Community and self-serve docs",
    sloLabel: "Best effort only",
    highlights: [
      "Up to 2 hosts",
      "1 operator seat",
      "Core host and container visibility",
      "Basic troubleshooting flows",
    ],
    restrictions: [
      "No advanced alert-rule creation",
      "No support response target",
      "Commercial guardrail for tiny environments only",
    ],
    ctaLabel: "Start Free",
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$29/mo",
    monthlyPrice: 29,
    audience: "Solo operators and small production teams.",
    summary: "Unlock premium alerting and a larger operating envelope without going through enterprise procurement.",
    supportLabel: "Email support",
    sloLabel: "1 business day response target",
    highlights: [
      "Up to 10 hosts",
      "Up to 5 operator seats",
      "Advanced alert rules",
      "Direct checkout or donor fallback",
    ],
    restrictions: [
      "Single-team operating model",
      "No contractual SLA/SLO",
      "Capacity and support limits are commercial policy today",
    ],
    ctaLabel: "Choose Pro",
  },
  {
    id: "team",
    name: "Team",
    priceLabel: "$79/mo",
    monthlyPrice: 79,
    audience: "Shared ops teams running multiple environments.",
    summary: "The default paid tier for teams that need advanced alerting, more seats, and faster human response when the control plane blocks work.",
    supportLabel: "Priority support",
    sloLabel: "4 business hour response target",
    highlights: [
      "Up to 50 hosts",
      "Up to 25 operator seats",
      "Advanced alert rules",
      "Onboarding and rollout assistance",
    ],
    restrictions: [
      "Still non-contractual unless upgraded to Enterprise",
      "Designed for one organization workspace",
      "Custom legal/security review not included",
    ],
    ctaLabel: "Choose Team",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom",
    monthlyPrice: null,
    audience: "Large fleets, regulated environments, and procurement-led teams.",
    summary: "Use this when you need commercial flexibility, security review, and contract-backed support expectations.",
    supportLabel: "Named support path",
    sloLabel: "Custom SLA/SLO",
    highlights: [
      "Custom host and seat limits",
      "Contract-backed support terms",
      "Security and rollout review",
      "Custom billing and procurement flow",
    ],
    restrictions: [
      "Requires direct engagement",
      "Scope and SLO are defined in contract",
      "Not self-serve checkout",
    ],
    ctaLabel: "Contact Sales",
  },
];

export const pricingComparisonRows = [
  {
    label: "Best for",
    values: {
      free: "Trying the product or running a small homelab",
      pro: "One operator or a small production pod",
      team: "A shared ops team with multiple environments",
      enterprise: "Large fleets and regulated buyers",
    },
  },
  {
    label: "Host allowance",
    values: {
      free: "Up to 2 hosts",
      pro: "Up to 10 hosts",
      team: "Up to 50 hosts",
      enterprise: "Custom",
    },
  },
  {
    label: "Operator seats",
    values: {
      free: "1 seat",
      pro: "Up to 5 seats",
      team: "Up to 25 seats",
      enterprise: "Custom",
    },
  },
  {
    label: "Advanced alert rules",
    values: {
      free: "No",
      pro: "Yes",
      team: "Yes",
      enterprise: "Yes",
    },
  },
  {
    label: "Support / SLO target",
    values: {
      free: "Best effort only",
      pro: "1 business day",
      team: "4 business hours",
      enterprise: "Contracted SLA/SLO",
    },
  },
  {
    label: "Commercial restrictions",
    values: {
      free: "Tiny environments only",
      pro: "Single-team, non-contractual",
      team: "One workspace, non-contractual",
      enterprise: "Contract-defined",
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
