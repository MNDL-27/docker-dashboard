export type PlanId = "free" | "pro" | "team" | "enterprise";

export type SubscriptionStatus = "active" | "inactive" | "past_due" | "canceled" | "paused";

export interface PlanPolicy {
  seatLimit: number | null;
  nodeLimit: number | null;
  logTailLines: number;
  maxPayloadBytes: number;
  canUseWebhookDestinations: boolean;
  canUseSlackDestinations: boolean;
  canUseAdvancedAlerts: boolean;
  canUseTeamCollaboration: boolean;
  canUseLogs: boolean;
  canUseFileManager: boolean;
}

export const PLAN_POLICY_BY_PLAN: Record<PlanId, PlanPolicy> = {
  free: {
    seatLimit: 1,
    nodeLimit: 1,
    logTailLines: 100,
    maxPayloadBytes: 4 * 1024 * 1024, // 4 MB
    canUseWebhookDestinations: false,
    canUseSlackDestinations: false,
    canUseAdvancedAlerts: false,
    canUseTeamCollaboration: false,
    canUseLogs: false,
    canUseFileManager: false,
  },
  pro: {
    seatLimit: 1,
    nodeLimit: 5,
    logTailLines: 1_000,
    maxPayloadBytes: 6 * 1024 * 1024, // 6 MB
    canUseWebhookDestinations: true,
    canUseSlackDestinations: false,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: false,
    canUseLogs: true,
    canUseFileManager: true,
  },
  team: {
    seatLimit: 10,
    nodeLimit: 25,
    logTailLines: 5_000,
    maxPayloadBytes: 10 * 1024 * 1024, // 10 MB
    canUseWebhookDestinations: true,
    canUseSlackDestinations: true,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: true,
    canUseLogs: true,
    canUseFileManager: true,
  },
  enterprise: {
    seatLimit: null,
    nodeLimit: null,
    logTailLines: 5_000,
    maxPayloadBytes: 10 * 1024 * 1024, // 10 MB
    canUseWebhookDestinations: true,
    canUseSlackDestinations: true,
    canUseAdvancedAlerts: true,
    canUseTeamCollaboration: true,
    canUseLogs: true,
    canUseFileManager: true,
  },
};

export function normalizePlan(value: string | null | undefined): PlanId {
  if (value === "dedicated") {
    return "enterprise";
  }

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
  forceStrictFreePlan = false,
}: {
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  isDonorPremium?: boolean;
  forceStrictFreePlan?: boolean;
}): PlanId {
  if (forceStrictFreePlan) {
    return "free";
  }

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