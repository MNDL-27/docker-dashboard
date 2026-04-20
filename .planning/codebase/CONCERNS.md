# Codebase Concerns

**Analysis Date:** 2026-04-20

## Tech Debt

**Restriction policy is mostly content-level, not enforcement-level:**
- Issue: Pricing restrictions are defined as display text and comparison copy, but there is no shared entitlement engine consumed by routes and APIs.
- Files: `src/lib/pricing.ts`, `src/pages/PricingPage.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx`, `netlify/functions/lib/access-controls.mts`
- Impact: Users can navigate and use many app areas regardless of plan promises, creating product-policy drift and support disputes.
- Fix approach: Centralize entitlement checks in one backend module (source of truth from `organizations.plan` + `subscription_status` + overrides), expose entitlement snapshot via `/api/auth/me`, and enforce in both API handlers and UI route/components.

**Premium integration surfaces are exposed without plan gating:**
- Issue: Slack and webhook destination APIs only check role/admin, not subscription entitlement.
- Files: `netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`, `src/pages/app/SettingsPage.tsx`, `src/components/layout/AppSidebar.tsx`
- Impact: Free-tier organizations can potentially configure integrations that pricing labels as restricted to higher tiers.
- Fix approach: Add explicit entitlement checks in these endpoints and hide/disable related UI tabs and navigation when entitlement is absent.

## Known Bugs

**Paid organizations can be denied advanced alert rules:**
- Symptoms: Organization admins on paid plans may receive `Advanced Alert Rules require a Premium or Team subscription.` while creating/updating rules.
- Files: `netlify/functions/lib/access-controls.mts`, `netlify/functions/api-alert-rules.mts`
- Trigger: `assertAdvancedAlertsAccessAllowed` evaluates `plan_override` and donor premium only; it does not evaluate base `organizations.plan` / `subscription_status`.
- Workaround: Apply `plan_override` manually via admin controls, or donor premium path.

**Organization access handler source appears incomplete:**
- Symptoms: Organization access flow is fragile at source level (handler references helpers but file only contains route dispatch scaffolding).
- Files: `netlify/functions/lib/org-access-handler.mts`, `netlify/functions/api-org-access.mts`, `netlify/functions/api-org-access-splat.mts`
- Trigger: Any change/rebuild touching this handler may fail or diverge from expected behavior.
- Workaround: None reliable; validate runtime bundle behavior before release.

## Security Considerations

**Authorization and billing entitlement are conflated inconsistently:**
- Risk: API endpoints correctly check tenant membership/role but often skip billing entitlement checks, enabling access to commercially restricted capabilities.
- Files: `netlify/functions/lib/auth.mts`, `netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-docker-proxy.mts`, `netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`
- Current mitigation: Tenant + role checks (`requireAuth`, org membership checks, admin checks).
- Recommendations: Introduce mandatory `assertFeatureEntitlement` middleware per feature class and fail closed when entitlement metadata is missing.

## Performance Bottlenecks

**Not a primary concern for pricing enforcement analysis:**
- Problem: Not assessed in this focused refresh.
- Files: `Not applicable`
- Cause: Scope targeted restriction consistency.
- Improvement path: Run dedicated performance audit separately.

## Fragile Areas

**Route-level gating uses onboarding/deployment state but not plan state:**
- Files: `src/components/ProtectedRoute.tsx`, `src/App.tsx`
- Why fragile: New premium routes/features can be added under `/app` without any entitlement barrier by default.
- Safe modification: Add a route guard wrapper that requires explicit entitlement flags per route segment.
- Test coverage: No frontend tests validating plan-based route denial/allow behavior detected.

**Documentation and implementation drift on billing/restrictions:**
- Files: `src/pages/DocsPage.tsx`, `src/pages/PricingPage.tsx`, `src/pages/app/BillingPage.tsx`
- Why fragile: Docs state billing/subscriptions as placeholder while billing UI and donor flow exist, increasing user confusion and support burden.
- Safe modification: Align docs with implemented behavior and explicitly list enforced vs informational limits.
- Test coverage: No documentation consistency checks detected.

## Scaling Limits

**Policy scaling limit (not compute):**
- Current capacity: Restriction enforcement is ad hoc per endpoint/component.
- Limit: As features grow, missed entitlement checks increase linearly and become difficult to audit.
- Scaling path: Adopt centralized entitlement matrix and automated endpoint inventory checks in CI.

## Dependencies at Risk

**Billing-state dependency without uniform enforcement contract:**
- Risk: `organizations.plan` / `subscription_status` / donor premium / admin overrides exist, but feature checks do not consume them consistently.
- Impact: Plan changes do not deterministically affect feature access sitewide.
- Migration plan: Standardize a single computed entitlement object and deprecate direct ad hoc checks.

## Missing Critical Features

**Sitewide entitlement enforcement layer:**
- Problem: No global mechanism guarantees that pricing restrictions from `/pricing` are enforced across routes, APIs, and settings surfaces.
- Blocks: Reliable monetization boundaries, predictable customer experience, and low-friction support resolution.

## Test Coverage Gaps

**No active tests for access-control enforcement paths:**
- What's not tested: Plan/subscription entitlement behavior for feature endpoints and UI route/tab gating.
- Files: `netlify/functions/lib/access-controls.test.ts`, `src/components/ProtectedRoute.tsx`, `netlify/functions/api-alert-rules.mts`, `netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`
- Risk: Regressions and policy drift can ship unnoticed.
- Priority: High

---

*Concerns audit: 2026-04-20*
