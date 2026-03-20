# Testing

## Framework

- **Vitest** ^3.2.4 — Test runner
- **jsdom** — Browser environment simulation
- **@testing-library/react** ^16.0.0 — React component testing utilities
- **@testing-library/jest-dom** ^6.6.0 — Custom DOM matchers

## Configuration

- Config file: `vitest.config.ts`
- Environment: `jsdom`
- Globals: `true` (no explicit imports needed for `describe`, `it`, `expect`)
- Setup file: `src/test/setup.ts`
- Include pattern: `src/**/*.{test,spec}.{ts,tsx}`
- Path alias: `@/` → `./src`

## Current Test State

**Minimal test coverage.** Only a placeholder test exists:

```
src/test/
├── setup.ts         # Imports @testing-library/jest-dom matchers
└── example.test.ts  # Placeholder test (verifies 1+1=2)
```

- No component tests
- No hook tests
- No integration tests
- No backend function tests (Netlify Functions are `.mts` — not covered by Vitest config)

## Test Commands

```bash
npm run test       # Single run (vitest run)
npm run test:watch # Watch mode (vitest)
```

## Testing Gaps

- **No unit tests** for any business logic
- **No component tests** for any React components
- **No API tests** for Netlify functions (different runtime, would need separate test setup)
- **No E2E tests** — No Playwright/Cypress configured
- **Backend test bypass:** `requireAuth()` supports `x-test-bypass` header for testing, but no automated tests use it
- **Mock agent:** `api-mock-docker-agent.mts` exists for manual testing but no automated integration
