# Concerns

## Technical Debt

### 1. Build Log Files Committed to Repo
- Files: `build.log`, `build2.log`, `build3.log`, `build-final.log`, `error.log`
- **Impact:** Clutters repo, shouldn't be in version control
- **Fix:** Add `*.log` to `.gitignore`, remove from tracking

### 2. Empty Contexts Directory
- Path: `src/contexts/` — directory exists but is empty
- **Impact:** Dead code / misleading structure
- **Fix:** Remove or use for future state management needs

### 3. Placeholder Pages
- Multiple app pages are minimal placeholders: `MonitoringPage`, `AlertsPage`, `IncidentsPage`, `DeploymentsPage`, `BillingPage`
- **Impact:** Users see incomplete features in navigation
- **Fix:** Either implement or hide from sidebar until ready

### 4. Multiple Lock Files
- Both `package-lock.json` and `bun.lock`/`bun.lockb` exist
- **Impact:** Potential dependency resolution conflicts between npm and Bun
- **Fix:** Standardize on one package manager, remove the other's lockfile

### 5. Dev Bypass Flag Hardcoded
- `BYPASS_BETA_GATE = true` in `src/components/ProtectedRoute.tsx`
- **Impact:** Beta approval gate permanently disabled — no access control for private beta
- **Fix:** Move to environment variable or remove before production launch

## Security Considerations

### Strengths
- ✓ AES-256-GCM encryption for Docker host secrets at rest
- ✓ AAD binding prevents ciphertext field swapping between hosts
- ✓ Clerk JWT verification on all protected endpoints
- ✓ Organization membership checks for data access
- ✓ Svix webhook signature verification
- ✓ Container ID sanitization against injection attacks
- ✓ Payload size limits (4MB) on Docker proxy responses
- ✓ Request timeouts (3-8s) prevent hanging connections
- ✓ `HEALTH_POLL_SECRET` protects cron endpoint

### Concerns
- **CORS:** `Access-Control-Allow-Origin: *` in Docker proxy — overly permissive for SaaS
- **Global Clerk access:** `window.Clerk?.session?.getToken()` bypasses React context — fragile pattern
- **Test bypass in auth:** `x-test-bypass` header accepted if `NODE_ENV === 'test'` — must ensure never leaked to production

## Performance Considerations

### Strengths
- ✓ SWC compiler (fast builds via `@vitejs/plugin-react-swc`)
- ✓ React Query polling with configurable intervals (10-30s)
- ✓ Bounded concurrency (max 5 parallel) for multi-host Docker fetches
- ✓ Neon serverless — auto-scaling database connections

### Concerns
- **N+1 queries in Docker proxy:** For `all-containers`, each host requires a separate DB query for secrets
- **No API response caching** — Every TanStack Query refetch hits the backend
- **Large container lists:** No pagination on container listings — could be slow for hosts with hundreds of containers
- **Three.js on login:** 3D particle background adds bundle size and GPU usage for a login page

## Fragile Areas

### 1. Onboarding Flow
- Complex multi-step wizard in `OnboardingPage.tsx` (~25KB, largest component)
- Hard-reload trick for session refresh after org creation (`sessionStorage` flag)
- Fragile interaction between `ProtectedRoute` auth checks and onboarding state

### 2. Clerk ↔ DB Sync
- Webhook is the only sync mechanism — missed events cause permanent desync
- No retry/reconciliation mechanism if webhook fails
- `auth.mts` throws "Sync pending" if Clerk ID not found in DB — race condition on signup

### 3. Docker Proxy Timeout Handling
- Different timeout values per action (3-8s) — could cause UX confusion when agents are slow
- 4MB payload limit silently truncates large log outputs
- No circuit breaker — repeatedly failing hosts still get polled

### 4. Type Safety Gaps
- `dockerApi` functions return `any` types from backend
- No runtime validation of API responses (rely on TypeScript at compile time only)
- Backend SQL queries return untyped `any[]`

## Known Issues

- **502 on empty state:** Dashboard previously crashed with 502 when user has zero hosts (documented as fixed)
- **Onboarding 401 bug:** Session continuation after org creation was fragile (documented as fixed via hard-reload strategy)
- **Missing `is_approved` column:** Referenced in code (`auth.mts`, `ProtectedRoute.tsx`) but not in `schema.sql` — likely added via migration
- **Missing `beta_allowlist` table:** Referenced in webhook handler but not in `schema.sql` — likely added via migration
