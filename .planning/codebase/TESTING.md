# Testing

## Current State

**Minimal test coverage.** The project has very few dedicated test files.

### Existing Tests

| File | Type | What It Tests |
|------|------|---------------|
| `netlify/functions/lib/admin-audit.test.ts` | Unit | Admin audit logging logic (520 bytes) |
| `netlify/functions/lib/org-access.test.ts` | Unit | Organization access control logic (1.8KB) |

### Manual Verification Scripts

Located in `.clean-test/` — these are ad-hoc verification scripts, not automated tests:

| Script | Purpose |
|--------|---------|
| `check-host.mts` | Manual host connectivity check |
| `check-host.mjs` | JS variant of host check |
| `query-hosts.mts` | Query host data from DB |
| `master-verify.mjs` | Master verification script |
| `final-status.mjs` | Final status check |
| `wipe-db.mts` | Database cleanup (destructive) |

## Test Framework

- No test framework is explicitly configured in `package.json`
- `npm test` and `npm run test:watch` are referenced in `CLAUDE.md` but not defined in scripts
- The `.test.ts` files exist but there's no test runner configured
- vitest would be the natural choice given the Vite build system

## Test Gaps

### Critical — No Tests
- **Docker proxy logic** (`api-docker-proxy.mts`, 753 lines) — the largest and most critical function
- **Agent enrollment flow** (`api-agent-enrollments.mts`, 595 lines) — complex multi-step enrollment
- **Encryption/decryption** (`crypto.mts`, 8KB) — security-critical
- **URL validation** (`host-url.mts`, 152 lines) — security boundary
- **Auth middleware** (`auth.mts`, 5.5KB) — authentication
- **Alert processing** (`alerts.mts`, 20KB) — complex business logic
- **Frontend hooks** — No component or hook tests
- **Onboarding state machine** (`useOnboardingState.ts`, 398 lines) — complex state logic

### Coverage Assessment
- **Backend**: ~1% test coverage (2 small test files out of ~50 source files)
- **Frontend**: 0% test coverage
- **Integration**: No integration tests
- **E2E**: No end-to-end tests

## Recommendations

1. **Add vitest** — Already using Vite, vitest integrates seamlessly
2. **Priority test targets**:
   - `host-url.mts` — URL validation has clear inputs/outputs, security-critical
   - `crypto.mts` — Encryption correctness is critical
   - `api-docker-proxy.mts` — Complex routing and normalization logic
   - `useOnboardingState.ts` — State machine with many transitions
3. **Testing pattern**: Unit tests for `lib/` utilities, integration tests for API functions using test database
