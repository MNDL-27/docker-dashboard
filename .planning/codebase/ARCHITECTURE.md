# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Client-heavy SPA plus file-based serverless backend.

**Key Characteristics:**
- `src/App.tsx` is the only frontend composition root; it wires Clerk auth, React Query, React Router, subdomain-aware routing, and lazy page loading.
- `netlify/functions/*.mts` exposes backend behavior as independent HTTP endpoints instead of a single long-lived API server.
- `shared/schema/*.ts` and `shared/lib/*.ts` hold cross-runtime contracts and helpers that are imported by both the browser bundle and Netlify functions.

## Layers

**Frontend shell and routing:**
- Purpose: bootstrap the browser app and route between marketing, docs, auth, onboarding, and app areas.
- Location: `src/main.tsx`, `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/RequireAppSubdomain.tsx`, `src/components/layout/AppShell.tsx`
- Contains: root providers, route guards, lazy page imports, app shell layout, subdomain logic.
- Depends on: `@clerk/clerk-react`, `@tanstack/react-query`, `react-router-dom`, `src/lib/hostname.ts`
- Used by: every page under `src/pages/`

**Page and feature composition:**
- Purpose: turn route-level screens into feature workspaces.
- Location: `src/pages/`, especially `src/pages/app/*.tsx` and `src/pages/onboarding/*.tsx`
- Contains: page orchestration, section layout, feature-specific view state, and composition of feature components.
- Depends on: hooks in `src/hooks/`, services in `src/services/`, and UI blocks in `src/components/`
- Used by: route entries declared in `src/App.tsx`

**Frontend data access:**
- Purpose: isolate HTTP access and cache orchestration from page components.
- Location: `src/lib/api.ts`, `src/services/*.ts`, `src/hooks/*.ts`
- Contains: authenticated fetch wrapper, typed service methods, React Query hooks, cache invalidation rules, polling intervals.
- Depends on: Netlify API routes under `/api/*`, Clerk session tokens, shared diagnostic helpers from `shared/lib/diagnostics.ts`
- Used by: app pages, settings panels, onboarding flows, dashboard components.

**Backend endpoint layer:**
- Purpose: map URL paths to request handlers and keep each concern in a dedicated function file.
- Location: `netlify/functions/*.mts`
- Contains: REST-like handlers such as `netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-docker-proxy.mts`, `netlify/functions/auth-me.mts`, `netlify/functions/api-org-access.mts`, `netlify/functions/api-alerts.mts`
- Depends on: helper modules in `netlify/functions/lib/`, database access through `netlify/functions/lib/db.mts`, and shared schemas under `shared/schema/`
- Used by: browser requests from `src/lib/api.ts`, scheduled Netlify invocations, and external webhook providers.

**Backend domain helpers:**
- Purpose: keep reusable backend logic out of individual endpoint files.
- Location: `netlify/functions/lib/*.mts` and `netlify/functions/lib/*.mjs`
- Contains: auth, access control, crypto, schema bootstrapping, billing helpers, admin helpers, alert delivery, email utilities, security/rate limiting, Docker host URL validation.
- Depends on: Neon SQL via `netlify/functions/lib/db.mts`, Clerk backend clients in `netlify/functions/lib/clerk.mts`, environment variables, and shared contracts.
- Used by: most `netlify/functions/*.mts` handlers.

**Shared contracts and helpers:**
- Purpose: enforce common request/response shapes and reuse non-UI logic across runtimes.
- Location: `shared/schema/api.ts`, `shared/schema/error.ts`, `shared/schema/proxy.ts`, `shared/lib/diagnostics.ts`, `shared/watchtower-agent-release.ts`
- Contains: Zod schemas, OpenAPI generation, proxy request validation, error response helpers, diagnostics summarization, agent release metadata helpers.
- Depends on: `zod`, `@asteasolutions/zod-to-openapi`
- Used by: `src/lib/api.ts`, `netlify/functions/api-docker-proxy.mts`, `netlify/functions/api-docs.mts`, release tooling.

## Data Flow

**Authenticated app request flow:**

1. A page or component calls a hook such as `src/hooks/useDocker.ts` or `src/hooks/useOrganizationAccess.ts`.
2. The hook calls a service method in `src/services/*.ts`, which delegates to `src/lib/api.ts`.
3. `src/lib/api.ts` fetches a Clerk session token, attaches `Authorization: Bearer ...`, retries once on `401`, and normalizes error payloads into `ApiError`.
4. Netlify redirects `/api/*` and `/auth/*` through `netlify.toml` into `netlify/functions/*.mts`.
5. The target function validates auth with `netlify/functions/lib/auth.mts`, runs access-control checks from `netlify/functions/lib/access-controls.mts`, then queries Neon via `netlify/functions/lib/db.mts`.
6. The function returns JSON, and React Query caches it under the query key defined in the hook.

**Docker control and observability flow:**

1. Frontend hooks in `src/hooks/useDocker.ts` call `src/services/docker-api.ts`.
2. `src/services/docker-api.ts` posts action payloads to `/api/docker-proxy`, generating idempotency keys for container mutations.
3. `netlify/functions/api-docker-proxy.mts` validates the request against `shared/schema/proxy.ts`.
4. The handler loads the target host and encrypted secrets from Postgres, decrypts them with `netlify/functions/lib/crypto.mjs`, and builds a request to the remote Watchtower agent.
5. The agent response is translated into normalized JSON for the UI; the handler also updates host status, heartbeat fields, and version metadata in `docker_hosts`.
6. Scheduled health checks in `netlify/functions/api-host-health-poll.mts` run separately to keep host health current even when no user is browsing.

**Onboarding and identity flow:**

1. `src/components/ProtectedRoute.tsx` calls `/api/auth/me` before allowing access to app routes.
2. `netlify/functions/auth-me.mts` uses Clerk identity, syncs against internal `users` and `organizations` tables, and computes onboarding plus dedicated-deployment state.
3. `ProtectedRoute` redirects the user to `/onboarding`, `/dedicated/intake`, `/app`, or `/app/dedicated-deployment` based on the returned state.

**State Management:**
- Server state lives in React Query hooks such as `src/hooks/useDocker.ts`, `src/hooks/useViewerState.ts`, `src/hooks/useOrganizationAccess.ts`, and `src/hooks/useAlerts.ts`.
- Route state lives in React Router path params and nested routes in `src/App.tsx`.
- Short-lived UI state stays local inside pages/components with `useState`, for example `src/components/ProtectedRoute.tsx` and many `src/pages/*` modules.
- There is no global client store such as Redux or Zustand.

## Key Abstractions

**API wrapper:**
- Purpose: one fetch path for every browser-to-backend call.
- Examples: `src/lib/api.ts`, `src/services/docker-api.ts`, `src/services/organization-access-api.ts`
- Pattern: thin services over a shared authenticated fetch helper.

**Route guard:**
- Purpose: centralize sign-in, organization, onboarding, and dedicated deployment gating.
- Examples: `src/components/ProtectedRoute.tsx`, `src/components/RequirePlatformAdmin.tsx`, `src/components/RequireAppSubdomain.tsx`
- Pattern: wrapper components that redirect before page content mounts.

**Per-endpoint handler file:**
- Purpose: keep each backend route independent and deployable as a single Netlify function.
- Examples: `netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-alert-rules.mts`, `netlify/functions/api-profile.mts`
- Pattern: default exported request handler plus `export const config = { path: ... }`.

**Schema bootstrapper:**
- Purpose: ensure required database tables/columns exist before endpoint logic runs.
- Examples: `netlify/functions/lib/ensure-onboarding-schema.mts`, `netlify/functions/lib/ensure-docker-host-schema.mts`, `netlify/functions/lib/ensure-alerts-schema.mts`
- Pattern: defensive runtime schema initialization invoked at the start of request handlers.

**Cross-runtime contract:**
- Purpose: validate inputs and document shared API shapes once.
- Examples: `shared/schema/proxy.ts`, `shared/schema/error.ts`, `shared/schema/api.ts`
- Pattern: Zod schema modules imported by backend handlers and documentation generators.

## Entry Points

**Browser entry:**
- Location: `src/main.tsx`
- Triggers: initial SPA boot in the browser.
- Responsibilities: mount `src/App.tsx` into `#root`.

**Frontend application root:**
- Location: `src/App.tsx`
- Triggers: every browser session.
- Responsibilities: configure providers, initialize Paddle, choose routes, and switch behavior by hostname and auth state.

**Primary API surface:**
- Location: `netlify/functions/*.mts`
- Triggers: `/api/*` and `/auth/*` requests rewritten by `netlify.toml`
- Responsibilities: auth, database access, Docker proxying, org management, alerts, billing, admin flows, docs spec serving, and webhooks.

**Scheduled maintenance:**
- Location: `netlify/functions/api-host-health-poll.mts`, `netlify/functions/api-donor-reminders.mts`
- Triggers: Netlify scheduled functions declared in `netlify.toml`
- Responsibilities: background polling, reminder dispatch, and health state maintenance.

**Release metadata tooling:**
- Location: `scripts/prepare-watchtower-agent-release.mjs`
- Triggers: `npm run release:agent`
- Responsibilities: prepare watchtower agent release metadata consumed by `shared/watchtower-agent-release.ts` and backend release reporting.

## Error Handling

**Strategy:** Normalize backend and upstream failures into JSON responses that the frontend can summarize consistently.

**Patterns:**
- Browser code throws `ApiError` from `src/lib/api.ts`, preserving HTTP status, structured body, raw text, and upstream status metadata.
- Docker proxy failures are classified in `netlify/functions/api-docker-proxy.mts` with problem-style JSON built from `shared/schema/error.ts`.
- Auth and access-control failures are centralized in `netlify/functions/lib/auth.mts` and `netlify/functions/lib/access-controls.mts`.
- Background polling in `netlify/functions/api-host-health-poll.mts` converts connection failures into host status changes instead of propagating them to a user request.

## Cross-Cutting Concerns

**Logging:** Backend functions use direct `console.error`, `console.warn`, and occasional structured context logging in files such as `netlify/functions/api-docker-proxy.mts` and `netlify/functions/auth-me.mts`.

**Validation:** Frontend validation is mostly local to forms, while backend request validation uses Zod schemas in `shared/schema/` and host URL normalization in `netlify/functions/lib/host-url.mts`.

**Authentication:** Clerk is the identity source in both runtimes, with browser auth in `src/App.tsx` and server auth in `netlify/functions/lib/auth.mts`.

**Authorization:** Multi-tenant and admin checks are enforced server-side through `netlify/functions/lib/access-controls.mts`, `netlify/functions/lib/admin-auth.mts`, and org membership queries in handlers.

**Tenant isolation:** The active Clerk organization is translated to internal organization IDs in `netlify/functions/lib/auth.mts`, then reused in endpoint queries and mutation guards.

**Security controls:** CORS and rate limiting live in `netlify/functions/lib/security.mts`; encrypted host secrets are handled in `netlify/functions/lib/crypto.mjs`; mutation endpoints require idempotency keys in `netlify/functions/api-docker-proxy.mts`.

---

*Architecture analysis: 2026-04-22*
