# Testing Patterns

**Analysis Date:** 2026-04-20

## Test Framework

**Runner:**
- Vitest (`vitest` in `package.json`; command `npm test` runs `vitest run`).
- No dedicated `vitest.config.*` file detected; globals are enabled in `tsconfig.app.json` via `types: ["vitest/globals"]`.

**Assertion Library:**
- Vitest `expect` assertions (`src/lib/api.test.ts`, `netlify/functions/lib/security.test.ts`).

**Run Commands:**
```bash
npm test                         # Run all tests once (vitest run)
npx vitest --watch              # Watch mode (CLI, no package script)
npx vitest run --coverage       # Coverage run (CLI, no package script)
```

## Test File Organization

**Location:**
- Tests are co-located near implementation.
- Frontend helpers: `src/lib/*.test.ts`.
- Shared helpers: `shared/lib/*.test.ts`.
- Function helpers: `netlify/functions/lib/*.test.ts`.

**Naming:**
- `*.test.ts` is the dominant naming pattern.

**Structure:**
```
src/lib/*.test.ts
shared/lib/*.test.ts
netlify/functions/lib/*.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";

describe("module behavior", () => {
  it("returns expected output", () => {
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- Behavior-focused `describe` blocks with narrowly scoped assertions.
- Cleanup hooks when mocks/timers are involved (`afterEach` in `netlify/functions/lib/security.test.ts`).
- Error contracts validated with `.toThrow(...)` (`netlify/functions/lib/org-access.test.ts`).

## Mocking

**Framework:**
- Vitest `vi.mock`, `vi.mocked`, fake timers.

**Patterns:**
```typescript
vi.mock("./db.mjs", () => ({ sql: vi.fn() }));
const mockedSql = vi.mocked(sql);
```
- Implemented in `netlify/functions/lib/security.test.ts`.

**What to Mock:**
- External boundaries (database and time) for deterministic policy tests (`netlify/functions/lib/security.test.ts`).

**What NOT to Mock:**
- Pure transformation/formatting utilities (`src/lib/api.test.ts`, `shared/lib/diagnostics.test.ts`).

## Fixtures and Factories

**Test Data:**
```typescript
expect(buildOrganizationAccessSummary(members, invites)).toEqual({
  members_count: 3,
  pending_invites_count: 1,
  admins_count: 2,
});
```
- Inline literals are preferred over fixture files (`netlify/functions/lib/org-access.test.ts`).

**Location:**
- No dedicated fixtures/factories directory detected.

## Coverage

**Requirements:**
- No enforced coverage threshold detected in `package.json` scripts or dedicated config files.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Primary test type; strong coverage for helper logic and normalization (`src/lib/api.test.ts`, `src/lib/host-health-state.test.ts`, `netlify/functions/lib/org-access.test.ts`).

**Integration Tests:**
- Explicitly deferred in at least two skipped files:
- `netlify/functions/lib/access-controls.test.ts`
- `netlify/functions/lib/donor-billing.test.ts`

**E2E Tests:**
- Not detected (no Playwright/Cypress config files found).

## Common Patterns

**Async Testing:**
```typescript
it("returns error payload when provider key is missing", async () => {
  const result = await sendEmail(...);
  expect(result.success).toBe(false);
});
```
- Pattern used in `netlify/functions/lib/email.test.ts`.

**Error Testing:**
```typescript
expect(() => assertOrganizationMemberMutationAllowed(args)).toThrow(/owner/i);
```
- Pattern used in `netlify/functions/lib/org-access.test.ts`.

## Sitewide Restriction Enforcement Testability

- `src/pages/PricingPage.tsx` renders restriction text from `src/lib/pricing.ts`, but no test currently verifies that those restrictions are enforced sitewide across routes or APIs.
- Hard enforcement observed in this scan is endpoint-specific, not global: `assertAdvancedAlertsAccessAllowed` in `netlify/functions/lib/access-controls.mts`, called by `netlify/functions/api-alert-rules.mts`.
- `src/components/ProtectedRoute.tsx` does not enforce paid-plan restrictions; it validates authentication, onboarding, and dedicated-deployment routing.
- Quality implication: pricing-copy changes can drift from real entitlement checks unless enforcement tests target actual guard points.
- Minimum regression set for this area:
  - Unit tests for `assertAdvancedAlertsAccessAllowed` free/pro/team/donor-admin branches in `netlify/functions/lib/access-controls.test.ts`.
  - Function-level integration tests for blocked/allowed `POST` and `PATCH` in `netlify/functions/api-alert-rules.mts` by organization plan.
  - Frontend route-level tests (if/when plan gating is added) around `src/components/ProtectedRoute.tsx` or a dedicated entitlement guard.

---

*Testing analysis: 2026-04-20*
