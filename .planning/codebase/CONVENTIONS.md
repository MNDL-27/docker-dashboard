# Coding Conventions

**Analysis Date:** 2026-04-22

## Naming Patterns

**Files:**
- Use `PascalCase.tsx` for page and feature components such as `src/pages/app/DashboardPage.tsx`, `src/components/shared/MetricCard.tsx`, and `src/components/settings/ProfileSettings.tsx`.
- Use `camelCase.ts` for hooks, services, and utilities such as `src/hooks/useDocker.ts`, `src/services/docker-api.ts`, and `src/lib/api.ts`.
- Use `.mts` or `.mjs` for Netlify function runtime modules such as `netlify/functions/api-alerts.mts` and `netlify/functions/lib/security.mts`.
- Use `index.ts` only as a small barrel or re-export file, as in `src/pages/onboarding/index.ts`.

**Functions:**
- Use `camelCase` for regular functions such as `summarizeApiErrorText` in `src/lib/api.ts` and `getAllowedOrigin` in `netlify/functions/lib/security.mts`.
- Use `useX` names for React hooks such as `useDockerHosts` in `src/hooks/useDocker.ts` and `useOnboardingState` in `src/pages/onboarding/useOnboardingState.ts`.
- Use `PascalCase` for React components such as `MetricCard` in `src/components/shared/MetricCard.tsx` and `PaddleInitializer` in `src/App.tsx`.

**Variables:**
- Use `camelCase` for local variables and object properties inside modules, for example `previewBypass` in `src/App.tsx` and `fetchOptions` in `src/lib/api.ts`.
- Use `SCREAMING_SNAKE_CASE` for constants that represent shared configuration or stable values, such as `API_BASE` in `src/lib/api.ts`, `TRUSTED_ORIGINS` and `RATE_LIMITS` in `netlify/functions/lib/security.mts`, and `STEPS` in `src/pages/onboarding/useOnboardingState.ts`.

**Types:**
- Use `PascalCase` for interfaces and type aliases such as `ApiErrorBody` in `src/lib/api.ts`, `DockerHostPingResult` in `src/services/docker-api.ts`, and `RateLimitConfig` in `netlify/functions/lib/security.mts`.
- Use quoted union literals for constrained string domains, as in `src/types/organization-access.ts` and `src/types/dedicated.ts`.

## Code Style

**Formatting:**
- Formatting is implicit rather than enforced by a dedicated formatter config. No Prettier or Biome config is present at the repo root.
- Use semicolons, trailing commas in multiline literals, double quotes in most frontend TypeScript, and two-space indentation, following files such as `src/lib/api.ts`, `src/hooks/useDocker.ts`, and `src/components/shared/MetricCard.tsx`.
- Preserve existing quote style per area when touching older Netlify files. Some server files use single quotes, for example `netlify/functions/lib/security.mts`.

**Linting:**
- Use the flat ESLint config in `eslint.config.js`.
- Lint applies to `**/*.{ts,tsx}` and ignores `dist`.
- Keep React Hooks rules satisfied. `react-hooks` recommended rules are enabled in `eslint.config.js`.
- Avoid relying on lint to catch dead code. `@typescript-eslint/no-unused-vars` is disabled in `eslint.config.js`.

## Import Organization

**Order:**
1. Local UI and app imports often appear first in frontend files, then third-party packages, as in `src/App.tsx`.
2. Some feature files start with third-party imports and then alias imports, as in `src/hooks/useDocker.ts`.
3. Use a single blank line between import block groups when the file already does so, as in `src/lib/api.ts` and `src/lib/api.test.ts`.

**Path Aliases:**
- Use the `@/*` alias configured in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts` for frontend code under `src`, for example `@/lib/api` and `@/components/ui/button`.
- Use relative paths for cross-package imports outside `src`, such as `../../shared/lib/diagnostics` in `src/lib/api.ts` and `./lib/security.mjs` in `netlify/functions/api-admin.mts`.

## Error Handling

**Patterns:**
- Normalize API failures into typed errors instead of throwing raw response text. Follow `ApiError` and `buildApiErrorMessage` in `src/lib/api.ts`.
- Return early for validation and guard failures, especially in server helpers such as `getAllowedOrigin` and `verifyWebhookTimestamp` in `netlify/functions/lib/security.mts`.
- Use `try`/`catch` only around operations that can genuinely fail and convert failures into user-facing or loggable messages, as in `PaddleInitializer` in `src/App.tsx` and JSON parsing in `src/lib/api.ts`.

## Logging

**Framework:** `console`

**Patterns:**
- Use `console.warn` and `console.error` for operational and security-relevant events on the Netlify side, as in `netlify/functions/lib/security.mts` and `netlify/functions/api-clerk-webhook.mts`.
- Frontend logging is limited and defensive. `src/App.tsx` logs third-party payment initialization warnings and failures.
- Keep structured metadata in logs when useful, for example `logSecurityEvent` in `netlify/functions/lib/security.mts`.

## Comments

**When to Comment:**
- Keep comments sparse and targeted. Add them for security behavior, network behavior, or workflow steps rather than for obvious UI code.
- Preserve useful explanatory comments in complex files such as `netlify/functions/lib/security.mts` and `src/App.tsx`.

**JSDoc/TSDoc:**
- JSDoc-style block comments appear mainly around shared helpers and onboarding flow components, for example `netlify/functions/lib/security.mts`, `src/pages/onboarding/LoadingCard.tsx`, and `src/pages/onboarding/StepHostBasics.tsx`.
- Do not add blanket JSDoc to every function; reserve it for exported helpers with non-obvious behavior.

## Function Design

**Size:** Function size varies widely. Keep simple UI components compact, like `src/components/shared/MetricCard.tsx`, but allow larger orchestrator functions in route files and server helpers when they coordinate multiple steps, such as `src/App.tsx` and `netlify/functions/lib/security.mts`.

**Parameters:** Prefer typed object parameters when mutation inputs are multi-field, as in `useAddDockerHost` and `useUpdateDockerHost` in `src/hooks/useDocker.ts`. Use positional parameters for narrow helpers such as `buildApiErrorMessage` in `src/lib/api.ts`.

**Return Values:** Return typed domain objects or plain serializable objects. Hooks return `useQuery` or `useMutation` results directly, as in `src/hooks/useDocker.ts`. Helper modules export pure functions with explicit return types where useful, as in `netlify/functions/lib/security.mts`.

## Module Design

**Exports:**
- Use default exports for route-level page modules such as `src/pages/app/HostsPage.tsx` and `src/pages/LandingPage.tsx`.
- Use named exports for reusable components, hooks, and utilities such as `src/components/shared/MetricCard.tsx`, `src/hooks/useDocker.ts`, and `src/lib/api.ts`.
- Group related API calls into exported service objects when the module represents a remote boundary, as in `src/services/docker-api.ts`.

**Barrel Files:** Barrel usage is limited. Keep barrels small and explicit, following `src/pages/onboarding/index.ts` and `src/components/ui/use-toast.ts`. Do not introduce wide re-export layers unless there is a clear navigation benefit.

---

*Convention analysis: 2026-04-22*
