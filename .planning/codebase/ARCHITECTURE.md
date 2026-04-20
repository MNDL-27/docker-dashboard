# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

**Overall:** React SPA + Netlify Functions with explicit per-route and per-endpoint guard checks.

**Key Characteristics:**
- Client routing is centralized in `src/App.tsx` and split into public, auth, and protected branches.
- Backend authorization is function-local through `requireAuth` in `netlify/functions/lib/auth.mts`.
- Restriction enforcement is capability-specific (for example advanced alerts), not a single sitewide pricing middleware.

## Layers

**Client Routing Layer:**
- Purpose: Define route map and route-level wrappers.
- Location: `src/App.tsx`
- Contains: Public routes (`/`, `/pricing`), auth routes, and nested `/app/*` protected routes.
- Depends on: `ProtectedRoute`, `RequireAppSubdomain`, `RequirePlatformAdmin`.
- Used by: Browser entrypoint in `src/main.tsx`.

**Client Gate Layer:**
- Purpose: Enforce auth and onboarding navigation constraints in the SPA.
- Location: `src/components/ProtectedRoute.tsx`, `src/components/RequireAppSubdomain.tsx`, `src/components/RequirePlatformAdmin.tsx`
- Contains: Redirect logic based on sign-in, org presence, onboarding, dedicated deployment state.
- Depends on: `GET /api/auth/me` and Clerk auth state.
- Used by: `/onboarding`, `/dedicated/intake`, and `/app/*` in `src/App.tsx`.

**Pricing Presentation Layer:**
- Purpose: Store and render pricing plan text and restrictions copy.
- Location: `src/lib/pricing.ts`, `src/pages/PricingPage.tsx`
- Contains: `pricingPlans`, `pricingComparisonRows`, CTA links.
- Depends on: Static plan metadata and React Router links.
- Used by: Public pricing route (`/pricing`) and billing UX.

**Checkout Intent Layer:**
- Purpose: Carry selected plan from public/login flow into billing checkout.
- Location: `src/pages/LoginPage.tsx`, `src/pages/app/BillingPage.tsx`
- Contains: `dockerdash_pending_plan` session storage intent and Paddle checkout launch.
- Depends on: `getCheckoutPriceId` from `src/lib/pricing.ts` and Paddle env IDs.
- Used by: Authenticated billing completion flow.

**API Handler Layer:**
- Purpose: Serve domain endpoints and call shared policy/auth helpers.
- Location: `netlify/functions/*.mts`
- Contains: Auth, hosts, proxy, alerts, organizations, admin, billing webhooks.
- Depends on: `netlify/functions/lib/*.mts`.
- Used by: `apiFetch` in `src/lib/api.ts`.

**Policy/Access Layer:**
- Purpose: Enforce tenant status, org locks, host quarantine, and premium feature checks.
- Location: `netlify/functions/lib/auth.mts`, `netlify/functions/lib/access-controls.mts`
- Contains: `requireAuth`, `assertTenantAccessAllowed`, `assertOrganizationWriteAllowed`, `assertHostProxyAllowed`, `assertAdvancedAlertsAccessAllowed`.
- Depends on: Clerk auth state and Postgres access-control tables.
- Used by: API handlers such as `netlify/functions/api-alert-rules.mts`, `netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-docker-proxy.mts`.

## Data Flow

**Pricing page restriction copy flow:**

1. `src/App.tsx` exposes `/pricing` as a public route.
2. `src/pages/PricingPage.tsx` reads `pricingPlans` from `src/lib/pricing.ts`.
3. `plan.restrictions` values are rendered as UI text only.

**Plan intent to checkout flow:**

1. Pricing CTA points to `/login?plan=<id>` in `src/pages/PricingPage.tsx`.
2. `src/pages/LoginPage.tsx` stores `dockerdash_pending_plan` (except free/enterprise).
3. `src/pages/app/BillingPage.tsx` reads pending plan, resolves Paddle price ID via `src/lib/pricing.ts`, and opens checkout with `organization_id` + `intended_plan` custom data.
4. Billing webhooks in `netlify/functions/api-billing-webhook.mts` update organization billing fields.

**Protected API flow:**

1. Client calls `apiFetch` in `src/lib/api.ts` with Clerk bearer token.
2. Netlify rewrite in `netlify.toml` routes `/api/*` to matching function.
3. Handler invokes `requireAuth` from `netlify/functions/lib/auth.mts`.
4. `requireAuth` resolves user/org and applies `assertTenantAccessAllowed`.
5. Endpoint applies additional feature guard when needed (for example `assertAdvancedAlertsAccessAllowed` in `netlify/functions/api-alert-rules.mts`).

**State Management:**
- Auth/session state: Clerk + `/api/auth/me` enrichment.
- Server data: React Query in hooks/pages.
- Temporary purchase intent: browser `sessionStorage`.

## Key Abstractions

**AppAuthContext:**
- Purpose: Canonical authenticated context for API handlers.
- Examples: `netlify/functions/lib/auth.mts`
- Pattern: `requireAuth(req, options)` throws or returns `{ userId, orgId, isPlatformAdmin, ... }`.

**Access-control assertions:**
- Purpose: Isolate policy checks from handlers.
- Examples: `netlify/functions/lib/access-controls.mts`
- Pattern: Dedicated assertion functions called before writes or privileged actions.

**Pricing catalog object:**
- Purpose: Single source for pricing copy and plan metadata.
- Examples: `src/lib/pricing.ts`
- Pattern: Typed static object consumed by pricing and billing UIs.

## Entry Points

**Frontend bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser app load.
- Responsibilities: Render app root and global styles.

**Frontend route graph:**
- Location: `src/App.tsx`
- Triggers: SPA route navigation.
- Responsibilities: Route partitioning and lazy page loading.

**Backend route rewrites:**
- Location: `netlify.toml`
- Triggers: Requests to `/api/*` and `/auth/*`.
- Responsibilities: Dispatch to `netlify/functions/api-*.mts` and `netlify/functions/auth-*.mts`.

## Error Handling

**Strategy:** Layered fail-fast checks with JSON error payloads.

**Patterns:**
- Client normalizes errors through `ApiError` in `src/lib/api.ts`.
- Route guard retries transient auth states in `src/components/ProtectedRoute.tsx`.
- API handlers map auth/policy failures to 401/403/409 or endpoint-specific statuses.

## Cross-Cutting Concerns

**Logging:** `console.log` and `console.error` in frontend and function handlers.
**Validation:** Schema and payload checks in handlers (for example proxy params in `netlify/functions/api-docker-proxy.mts`).
**Authentication:** Clerk request validation in `netlify/functions/lib/auth.mts`.

## Restriction Enforcement Scope (Pricing Question)

**Finding:** Restrictions shown on `https://dockerdash.app/pricing` are not globally enforced sitewide by themselves.

- UI-only pricing restrictions source: `src/lib/pricing.ts` rendered by `src/pages/PricingPage.tsx`.
- Public access evidence: `/pricing` route in `src/App.tsx` is outside `ProtectedRoute`.
- Real enforcement points:
  - Tenant/user/org controls in `netlify/functions/lib/auth.mts` + `netlify/functions/lib/access-controls.mts`.
  - Feature-specific premium gate in `netlify/functions/api-alert-rules.mts` via `assertAdvancedAlertsAccessAllowed`.
  - Write/proxy safety gates in `netlify/functions/api-docker-hosts.mts` and `netlify/functions/api-docker-proxy.mts` via access-control assertions.
- Netlify routing evidence: `netlify.toml` rewrites traffic but does not implement plan restriction middleware.

---

*Architecture analysis: 2026-04-20*
