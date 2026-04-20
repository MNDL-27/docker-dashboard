# Handoff: Codebase Map Refresh (Pricing Restriction Scope)

Date: 2026-04-20

## Objective
Refresh `.planning/codebase/` and evaluate whether pricing restrictions shown on `https://dockerdash.app/pricing` are enforced sitewide.

## Decision Summary
- Pricing-page restrictions are mostly presentation metadata, not a sitewide enforcement layer.
- Enforcement is currently localized to specific backend checks and selected routes/features.

## Evidence Paths
- Pricing copy source: `src/lib/pricing.ts`
- Pricing route/rendering: `src/pages/PricingPage.tsx`, `src/App.tsx`
- Auth/access assertions: `netlify/functions/lib/auth.mts`, `netlify/functions/lib/access-controls.mts`
- Feature-specific premium gate: `netlify/functions/api-alert-rules.mts`
- Not broadly plan-gated examples: `netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`, `netlify/functions/api-docker-hosts.mts`

## Outputs Updated
- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

## Suggested Next Steps
1. Add a centralized entitlement contract (plan + subscription + overrides => computed feature flags).
2. Enforce entitlement at API boundaries first (fail closed when unknown).
3. Mirror entitlement in UI route/component guards to reduce UX-policy drift.
4. Add tests for allow/deny matrix per plan across critical endpoints.
