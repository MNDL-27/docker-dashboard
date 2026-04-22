export type PlanId = "free" | "pro" | "team" | "enterprise";

export type SubscriptionStatus = "active" | "inactive" | "past_due" | "canceled" | "paused";

export interface PlanPolicy {
  seatLimit: number | null;
  nodeLimit: number | null;
  monthlyScanLimit: number | null;
  canUseWebhookDestinations: boolean;
  canUseSlackDestinations: boolean;
  canUseAdvancedAlerts: boolean;
  canUseTeamCollaboration: boolean;
}

export const PLAN_POLICY_BY_PLAN: Record<PlanId, PlanPolicy> = {
  free: {
    seatLimit: 1,
    nodeLimit: 1,
    monthlyScanLimit: 100,
    canUseWebhookDestinations: false,
    canUseSlackDestinations: false,
    canUseAdvancedAlerts: false,
    canUseTeamCollaboration: false,
  },
  pro: {
    seatLimit: 1,
    nodeLimit: 5,
    monthlyScanLimit: null,
    canUseWebhookDestinations: true,
    canUseSlackDestinations: false,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: false,
  },
  team: {
    seatLimit: 10,
    nodeLimit: 25,
    monthlyScanLimit: null,
    canUseWebhookDestinations: true,
    canUseSlackDestinations: true,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: true,
  },
  enterprise: {
    seatLimit: null,
    nodeLimit: null,
    monthlyScanLimit: null,
    canUseWebhookDestinations: true,
    canUseSlackDestinations: true,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: true,
  },
};

export function normalizePlan(value: string | null | undefined): PlanId {
  if (value === "pro" || value === "team" || value === "enterprise") {
    return value;
  }

  return "free";
}

export function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  if (value === "active" || value === "past_due" || value === "inactive" || value === "canceled" || value === "paused") {
    return value;
  }

  return "inactive";
}

export function isPaidSubscriptionStatus(status: SubscriptionStatus) {
  return status === "active" || status === "past_due";
}

export function getEffectivePlanForEnforcement({
  plan,
  subscriptionStatus,
  isDonorPremium,
}: {
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  isDonorPremium?: boolean;
}): PlanId {
  const normalizedPlan = normalizePlan(plan);
  const normalizedStatus = normalizeSubscriptionStatus(subscriptionStatus);
  const isPaidPlan = normalizedPlan !== "free";
  const isPaidSubscriptionActive = isPaidPlan && isPaidSubscriptionStatus(normalizedStatus);

  if (isPaidSubscriptionActive) {
    return normalizedPlan;
  }

  if (isDonorPremium) {
    return "pro";
  }

  return "free";
}