# Coding Conventions

**Analysis Date:** 2026-04-20

## Naming Patterns

**Files:**
- React pages and UI components use `PascalCase.tsx` (for example `src/pages/PricingPage.tsx`, `src/components/ProtectedRoute.tsx`).
- Frontend hooks and utility modules use lowercase/hyphen names with hook prefix where applicable (for example `src/hooks/useViewerState.ts`, `src/lib/host-health-state.ts`, `src/lib/pricing.ts`).
- Netlify functions use kebab-case with API naming prefixes (for example `netlify/functions/api-alert-rules.mts`, `netlify/functions/auth-me.mts`).

**Functions:**
- Component functions are `PascalCase` (`PricingPage`, `BillingPage`).
- Helpers and guards are `camelCase` (`getCheckoutPriceId`, `assertAdvancedAlertsAccessAllowed`).

**Variables:**
- Local variables use `camelCase`; shared constants use `UPPER_SNAKE_CASE` when globally scoped (`TRUSTED_ORIGINS` in `netlify/functions/lib/security.mts`).

**Types:**
- Interfaces and type aliases use `PascalCase` (`PricingPlan` in `src/lib/pricing.ts`, `ViewerState` in `src/hooks/useViewerState.ts`).

## Code Style

**Formatting:**
- No Prettier/Biome config file detected.
- Semicolons and trailing commas are used broadly.
- Quote style differs by layer: frontend often uses double quotes (`src/App.tsx`), functions often use single quotes (`netlify/functions/auth-me.mts`).

**Linting:**
- ESLint with `typescript-eslint` is configured in `eslint.config.js`.
- React hooks rules are enabled via `eslint-plugin-react-hooks`.
- Fast-refresh export guard is warning-level (`react-refresh/only-export-components`).
- `@typescript-eslint/no-unused-vars` is disabled.

## Import Organization

**Order:**
1. External packages (`react-router-dom`, `@clerk/clerk-react`, `@tanstack/react-query`, icon libs).
2. Internal alias imports using `@/`.
3. Relative local imports.

**Path Aliases:**
- `@/*` is mapped to `./src/*` in `tsconfig.json` and `tsconfig.app.json`.

## Error Handling

**Patterns:**
- Netlify handlers map failures to explicit HTTP responses and JSON payloads (`netlify/functions/auth-me.mts`, `netlify/functions/api-alert-rules.mts`).
- Frontend pages handle recoverable states with branch-based UI and toast messaging (`src/pages/app/BillingPage.tsx`).
- Error normalization helpers convert heterogeneous backend payloads into readable strings (`src/lib/api.ts`, tested in `src/lib/api.test.ts`).

## Logging

**Framework:**
- Native `console` logging.

**Patterns:**
- Bootstrap and integration checks log warnings/errors (`src/App.tsx`, `src/pages/app/BillingPage.tsx`).
- Function handlers log caught errors before returning mapped status codes (`netlify/functions/auth-me.mts`).

## Comments

**When to Comment:**
- Comments are used sparingly to mark major render branches or flow intent (`src/pages/app/BillingPage.tsx`).

**JSDoc/TSDoc:**
- Not a dominant convention in sampled frontend/functions modules.

## Function Design

**Size:**
- Utility modules trend small and single-purpose (`src/lib/pricing.ts`, `netlify/functions/lib/org-access.mts`).
- Feature pages can be large and branch-heavy (`src/pages/app/BillingPage.tsx`).

**Parameters:**
- Multi-condition policy functions use object parameter bags for readability (`assertTenantAccessAllowed`, `assertAdvancedAlertsAccessAllowed` in `netlify/functions/lib/access-controls.mts`).

**Return Values:**
- Guards throw typed error messages for callers to map (`netlify/functions/lib/access-controls.mts`).
- Query hooks and auth checks return structured objects (`src/hooks/useViewerState.ts`, `src/components/ProtectedRoute.tsx`).

## Module Design

**Exports:**
- Default exports for page components (`src/pages/PricingPage.tsx`, `src/pages/app/BillingPage.tsx`).
- Named exports for helpers/types (`src/lib/pricing.ts`, `netlify/functions/lib/org-access.mts`).

**Barrel Files:**
- Limited usage; direct module imports are the dominant pattern.

## Pricing Restriction Enforcement Convention

- Treat restriction strings in `src/lib/pricing.ts` and rendering in `src/pages/PricingPage.tsx` as product copy and plan metadata, not as automatic sitewide authorization.
- Current hard enforcement in sampled code is endpoint-scoped policy checks, especially `assertAdvancedAlertsAccessAllowed` in `netlify/functions/lib/access-controls.mts`, invoked by `netlify/functions/api-alert-rules.mts`.
- Route guard logic in `src/components/ProtectedRoute.tsx` enforces auth/onboarding/dedicated-deployment state and does not apply plan-tier gating across all `/app/*` routes.

---

*Convention analysis: 2026-04-20*
