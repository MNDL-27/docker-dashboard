# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Runner:**
- Vitest `^2.1.8`
- Config: no dedicated `vitest.config.*` file detected; the active setup comes from defaults plus `tsconfig.app.json` including `vitest/globals`

**Assertion Library:**
- Vitest `expect`

**Run Commands:**
```bash
npm test                  # Run the full suite via `vitest run`
npx vitest                # Start Vitest in interactive/watch mode when needed
npx vitest --coverage     # Coverage run; no dedicated npm script is configured
```

## Test File Organization

**Location:**
- Keep frontend unit tests co-located with the module under test, for example `src/lib/api.test.ts` beside `src/lib/api.ts` and `src/lib/host-health-state.test.ts` beside `src/lib/host-health-state.ts`.
- Keep Netlify helper tests next to the helper module in `netlify/functions/lib`, for example `netlify/functions/lib/security.test.ts`.
- Keep shared-library tests beside shared code, for example `shared/lib/diagnostics.test.ts`.

**Naming:**
- Use `*.test.ts` naming consistently.
- No `*.spec.ts` files are currently present.

**Structure:**
```text
src/lib/*.test.ts
shared/lib/*.test.ts
netlify/functions/lib/*.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";

import { buildApiErrorMessage, summarizeApiErrorText } from "@/lib/api";

describe("api error normalization", () => {
  it("uses RFC7807 problem details when present", () => {
    expect(
      buildApiErrorMessage(502, { title: "Connection test failed", detail: "..." }, ""),
    ).toBe("Connection test failed: ...");
  });
});
```

**Patterns:**
- Use `describe` blocks named after the module or behavior, as in `src/lib/api.test.ts`, `shared/lib/diagnostics.test.ts`, and `netlify/functions/lib/security.test.ts`.
- Keep each `it` focused on one branch or one business rule.
- Prefer direct value assertions with `toBe`, `toEqual`, `toMatchObject`, `toContain`, and `toThrow`.
- Use `afterEach` for cleanup when mocks or fake timers are involved, as in `netlify/functions/lib/security.test.ts`.

## Mocking

**Framework:** `vi`

**Patterns:**
```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.mjs", () => ({
  sql: vi.fn(),
}));

import { sql } from "./db.mjs";

const mockedSql = vi.mocked(sql);

afterEach(() => {
  mockedSql.mockReset();
  vi.useRealTimers();
});
```

**What to Mock:**
- Mock hard external boundaries such as database adapters, as in `netlify/functions/lib/security.test.ts`.
- Mock time when behavior depends on retry windows or expiration calculations, using `vi.useFakeTimers()` and `vi.setSystemTime(...)`.

**What NOT to Mock:**
- Do not mock pure text, parsing, or normalization helpers. `src/lib/api.test.ts`, `src/lib/host-health-state.test.ts`, and `shared/lib/diagnostics.test.ts` exercise the real implementation directly.
- Avoid mocking internal logic when the function is deterministic and side-effect free.

## Fixtures and Factories

**Test Data:**
```typescript
const raw = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>dockerdash.app | 502: Bad gateway</title>
    </head>
    <body>cloudflare</body>
  </html>
`;

expect(summarizeApiErrorText(raw, 502)).toBe(
  "Cloudflare gateway error: dockerdash.app | 502: Bad gateway. Verify the saved host URL, tunnel or reverse proxy, and the Watchtower agent service.",
);
```

**Location:**
- Inline fixtures are the current default. Tests define payloads, timestamps, and expected objects inside each file rather than through shared factories.
- No dedicated `fixtures/` or `factories/` directory is present.

## Coverage

**Requirements:** None enforced by config or npm script.

**View Coverage:**
```bash
npx vitest --coverage
```

## Test Types

**Unit Tests:**
- Pure helper coverage is the dominant pattern. Examples include `src/lib/api.test.ts`, `src/lib/host-health-state.test.ts`, and `shared/lib/diagnostics.test.ts`.
- Netlify library tests also behave as unit tests when they isolate a helper behind mocks, such as `netlify/functions/lib/security.test.ts`.

**Integration Tests:**
- Lightweight integration-style coverage exists around Netlify helper behavior, but there is no separate integration test harness.
- Two placeholders are explicitly skipped because they require runtime or live DB context: `netlify/functions/lib/access-controls.test.ts` and `netlify/functions/lib/donor-billing.test.ts`.

**E2E Tests:**
- Not detected. No Playwright, Cypress, or browser E2E config is present.

## Common Patterns

**Async Testing:**
```typescript
it("uses shared SQL storage for rate limiting windows", async () => {
  mockedSql.mockResolvedValueOnce([{ count: 1, reset_at_ms: String(60_000) }]);

  const result = await checkRateLimit("api:127.0.0.1", { windowMs: 60_000, maxRequests: 3 });

  expect(result).toEqual({
    allowed: true,
    remaining: 2,
    resetAt: 60_000,
  });
});
```

**Error Testing:**
```typescript
expect(() => assertAdminReason("")).toThrow(/reason is required/i);
expect(() => assertManageRoleChange(...)).toThrow(/last owner/i);
```

---

*Testing analysis: 2026-04-22*
