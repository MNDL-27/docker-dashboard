import { describe, expect, it } from "vitest";

import {
  PLAN_POLICY_BY_PLAN,
  normalizePlan,
  normalizeSubscriptionStatus,
  isPaidSubscriptionStatus,
  getEffectivePlanForEnforcement,
} from "./plan-policy";

// ── normalizePlan ────────────────────────────────────────────────────

describe("normalizePlan", () => {
  it("passes through known plan IDs", () => {
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("team")).toBe("team");
    expect(normalizePlan("enterprise")).toBe("enterprise");
  });

  it("defaults null, undefined, and unknown values to free", () => {
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
    expect(normalizePlan("")).toBe("free");
    expect(normalizePlan("premium")).toBe("free");
    expect(normalizePlan("unknown")).toBe("free");
  });
});

// ── normalizeSubscriptionStatus ──────────────────────────────────────

describe("normalizeSubscriptionStatus", () => {
  it("passes through known statuses", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active");
    expect(normalizeSubscriptionStatus("inactive")).toBe("inactive");
    expect(normalizeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeSubscriptionStatus("canceled")).toBe("canceled");
    expect(normalizeSubscriptionStatus("paused")).toBe("paused");
  });

  it("defaults null, undefined, and unknown to inactive", () => {
    expect(normalizeSubscriptionStatus(null)).toBe("inactive");
    expect(normalizeSubscriptionStatus(undefined)).toBe("inactive");
    expect(normalizeSubscriptionStatus("")).toBe("inactive");
    expect(normalizeSubscriptionStatus("trialing")).toBe("inactive");
  });
});

// ── isPaidSubscriptionStatus ─────────────────────────────────────────

describe("isPaidSubscriptionStatus", () => {
  it("returns true for active", () => {
    expect(isPaidSubscriptionStatus("active")).toBe(true);
  });

  it("returns true for past_due (still considered paid until fully canceled)", () => {
    expect(isPaidSubscriptionStatus("past_due")).toBe(true);
  });

  it("returns false for non-paying statuses", () => {
    expect(isPaidSubscriptionStatus("inactive")).toBe(false);
    expect(isPaidSubscriptionStatus("canceled")).toBe(false);
    expect(isPaidSubscriptionStatus("paused")).toBe(false);
  });
});

// ── PLAN_POLICY_BY_PLAN constants ────────────────────────────────────

describe("PLAN_POLICY_BY_PLAN", () => {
  it("free plan allows exactly 1 host", () => {
    expect(PLAN_POLICY_BY_PLAN.free.nodeLimit).toBe(1);
  });

  it("free plan has 1 seat", () => {
    expect(PLAN_POLICY_BY_PLAN.free.seatLimit).toBe(1);
  });

  it("pro plan allows 5 hosts", () => {
    expect(PLAN_POLICY_BY_PLAN.pro.nodeLimit).toBe(5);
  });

  it("team plan allows 25 hosts", () => {
    expect(PLAN_POLICY_BY_PLAN.team.nodeLimit).toBe(25);
  });

  it("enterprise plan has no host limit", () => {
    expect(PLAN_POLICY_BY_PLAN.enterprise.nodeLimit).toBeNull();
  });

  it("free plan disables paid features", () => {
    const free = PLAN_POLICY_BY_PLAN.free;
    expect(free.canUseWebhookDestinations).toBe(false);
    expect(free.canUseSlackDestinations).toBe(false);
    expect(free.canUseAdvancedAlerts).toBe(false);
    expect(free.canUseTeamCollaboration).toBe(false);
    expect(free.canUseLogs).toBe(false);
    expect(free.canUseFileManager).toBe(false);
  });
});

// ── getEffectivePlanForEnforcement ───────────────────────────────────
// This is the core "downgrade" logic. It determines what plan limits
// to enforce based on the org's plan + subscription status + donor status.

describe("getEffectivePlanForEnforcement", () => {
  // ── Active paid subscriptions ──────────────────────────────────────

  it("returns pro for a pro plan with active subscription", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "pro", subscriptionStatus: "active" }),
    ).toBe("pro");
  });

  it("returns team for a team plan with active subscription", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "team", subscriptionStatus: "active" }),
    ).toBe("team");
  });

  it("returns enterprise for an enterprise plan with active subscription", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "enterprise", subscriptionStatus: "active" }),
    ).toBe("enterprise");
  });

  // ── Past due (still paid, grace period) ────────────────────────────

  it("returns pro for a pro plan with past_due status", () => {
    // past_due is still considered "paid" — user is in grace period
    expect(
      getEffectivePlanForEnforcement({ plan: "pro", subscriptionStatus: "past_due" }),
    ).toBe("pro");
  });

  // ── Canceled / expired → DROPS TO FREE ─────────────────────────────

  it("drops pro plan with canceled status to free (THE DOWNGRADE FLOW)", () => {
    // This is the exact scenario: paid user cancels → plan='pro', status='canceled'
    // The user should be treated as free until they re-subscribe
    expect(
      getEffectivePlanForEnforcement({ plan: "pro", subscriptionStatus: "canceled" }),
    ).toBe("free");
  });

  it("drops team plan with canceled status to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "team", subscriptionStatus: "canceled" }),
    ).toBe("free");
  });

  it("drops pro plan with inactive status to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "pro", subscriptionStatus: "inactive" }),
    ).toBe("free");
  });

  it("drops pro plan with paused status to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "pro", subscriptionStatus: "paused" }),
    ).toBe("free");
  });

  // ── Free plan variations ───────────────────────────────────────────

  it("returns free for a free plan regardless of status", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "free", subscriptionStatus: "active" }),
    ).toBe("free");
    expect(
      getEffectivePlanForEnforcement({ plan: "free", subscriptionStatus: "canceled" }),
    ).toBe("free");
    expect(
      getEffectivePlanForEnforcement({ plan: "free", subscriptionStatus: "inactive" }),
    ).toBe("free");
  });

  // ── Donor premium ──────────────────────────────────────────────────

  it("grants pro limits to free users with active donor premium", () => {
    expect(
      getEffectivePlanForEnforcement({
        plan: "free",
        subscriptionStatus: "inactive",
        isDonorPremium: true,
      }),
    ).toBe("pro");
  });

  it("does NOT grant pro limits if donor premium expired", () => {
    // isDonorPremium = false (or undefined) → falls back to free
    expect(
      getEffectivePlanForEnforcement({
        plan: "free",
        subscriptionStatus: "inactive",
        isDonorPremium: false,
      }),
    ).toBe("free");
  });

  it("donor premium does NOT override an active paid plan", () => {
    // If they're already pro, donor premium doesn't change anything
    expect(
      getEffectivePlanForEnforcement({
        plan: "pro",
        subscriptionStatus: "active",
        isDonorPremium: true,
      }),
    ).toBe("pro");
  });

  it("donor premium rescues canceled paid subscriptions back to pro", () => {
    // The canceled plan would normally drop to free, but donor premium
    // catches it and promotes back to pro
    expect(
      getEffectivePlanForEnforcement({
        plan: "pro",
        subscriptionStatus: "canceled",
        isDonorPremium: true,
      }),
    ).toBe("pro");
  });

  // ── Null/undefined inputs ──────────────────────────────────────────

  it("defaults null plan to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: null, subscriptionStatus: null }),
    ).toBe("free");
  });

  it("defaults undefined plan to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: undefined, subscriptionStatus: undefined }),
    ).toBe("free");
  });

  it("defaults unknown plan strings to free", () => {
    expect(
      getEffectivePlanForEnforcement({ plan: "premium_plus", subscriptionStatus: "active" }),
    ).toBe("free");
  });
});

// ── Integration: plan policy + effective plan → nodeLimit ────────────
// These simulate the full downgrade outcome: what nodeLimit does the user get?

describe("downgrade flow — effective node limit", () => {
  function resolveNodeLimit(opts: {
    plan: string | null | undefined;
    subscriptionStatus: string | null | undefined;
    isDonorPremium?: boolean;
  }) {
    const effective = getEffectivePlanForEnforcement(opts);
    return PLAN_POLICY_BY_PLAN[effective].nodeLimit;
  }

  // ── SCENARIO: User has 5 hosts on pro, then cancels ───────────────

  it("SCENARIO: pro user with active subscription → nodeLimit = 5", () => {
    expect(resolveNodeLimit({ plan: "pro", subscriptionStatus: "active" })).toBe(5);
  });

  it("SCENARIO: pro user cancels → nodeLimit drops to 1 (free)", () => {
    // Webhook sends subscription.canceled → plan stays 'pro' but
    // isPaidSubscriptionActive becomes false → getEffectivePlanForEnforcement
    // returns 'free' → nodeLimit = 1
    expect(resolveNodeLimit({ plan: "pro", subscriptionStatus: "canceled" })).toBe(1);
  });

  // ── SCENARIO: User has team plan (25 hosts), then cancels ─────────

  it("SCENARIO: team user with active subscription → nodeLimit = 25", () => {
    expect(resolveNodeLimit({ plan: "team", subscriptionStatus: "active" })).toBe(25);
  });

  it("SCENARIO: team user cancels → nodeLimit drops to 1 (free)", () => {
    expect(resolveNodeLimit({ plan: "team", subscriptionStatus: "canceled" })).toBe(1);
  });

  // ── SCENARIO: User is on free plan, never paid ────────────────────

  it("SCENARIO: free user (never paid) → nodeLimit = 1", () => {
    expect(resolveNodeLimit({ plan: "free", subscriptionStatus: "inactive" })).toBe(1);
    expect(resolveNodeLimit({ plan: "free", subscriptionStatus: null })).toBe(1);
  });

  // ── SCENARIO: Donor premium user ──────────────────────────────────

  it("SCENARIO: donor with inactive free plan → nodeLimit = 5 (pro)", () => {
    expect(
      resolveNodeLimit({ plan: "free", subscriptionStatus: "inactive", isDonorPremium: true }),
    ).toBe(5);
  });

  it("SCENARIO: donor premium expires → nodeLimit drops to 1", () => {
    expect(
      resolveNodeLimit({ plan: "free", subscriptionStatus: "inactive", isDonorPremium: false }),
    ).toBe(1);
  });

  // ── SCENARIO: Enterprise (unlimited) ──────────────────────────────

  it("SCENARIO: enterprise active → nodeLimit = null (unlimited)", () => {
    expect(resolveNodeLimit({ plan: "enterprise", subscriptionStatus: "active" })).toBeNull();
  });

  it("SCENARIO: enterprise canceled → nodeLimit = 1", () => {
    // Enterprise with canceled subscription drops to free too
    expect(resolveNodeLimit({ plan: "enterprise", subscriptionStatus: "canceled" })).toBe(1);
  });
});
