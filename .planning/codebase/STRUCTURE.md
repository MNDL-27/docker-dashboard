# Codebase Structure

**Analysis Date:** 2026-04-20

## Directory Layout

```
docker-watchtower-dash/
|-- src/                    # React SPA (routes, pages, components, hooks, client libs)
|-- netlify/functions/      # Netlify serverless handlers
|-- netlify/functions/lib/  # Shared backend auth/policy/security/domain helpers
|-- shared/                 # Shared diagnostics/schemas used across runtime boundaries
|-- db-migrations/          # SQL migration scripts
|-- public/                 # Static web assets
|-- scripts/                # Utility scripts
|-- .planning/codebase/     # Generated codebase mapping docs
|-- netlify.toml            # Build + redirect + function routing config
```

## Directory Purposes

**`src/`:**
- Purpose: Client-side application logic.
- Contains: Routing in `src/App.tsx`, bootstrap `src/main.tsx`, and page/component domains.
- Key files: `src/App.tsx`, `src/lib/api.ts`, `src/lib/pricing.ts`, `src/components/ProtectedRoute.tsx`.

**`src/pages/`:**
- Purpose: Route-level screens.
- Contains: Public marketing/auth pages and protected pages under `src/pages/app/`.
- Key files: `src/pages/PricingPage.tsx`, `src/pages/LoginPage.tsx`, `src/pages/app/BillingPage.tsx`.

**`src/components/`:**
- Purpose: Reusable UI and route wrappers.
- Contains: Layout, app shell, access wrappers, UI primitives.
- Key files: `src/components/ProtectedRoute.tsx`, `src/components/RequireAppSubdomain.tsx`, `src/components/layout/AppShell.tsx`.

**`netlify/functions/`:**
- Purpose: Request handlers for `/api/*` and `/auth/*`.
- Contains: Endpoint handlers by domain.
- Key files: `netlify/functions/auth-me.mts`, `netlify/functions/api-alert-rules.mts`, `netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-docker-proxy.mts`.

**`netlify/functions/lib/`:**
- Purpose: Shared backend internals.
- Contains: Auth context, access controls, schema guards, security, billing helpers.
- Key files: `netlify/functions/lib/auth.mts`, `netlify/functions/lib/access-controls.mts`, `netlify/functions/lib/security.mts`, `netlify/functions/lib/donor-billing.mts`.

**`shared/`:**
- Purpose: Cross-layer shared modules.
- Contains: Diagnostic formatting and schema utilities imported by frontend and backend.
- Key files: `shared/lib/diagnostics.ts`, `shared/schema/error.ts`, `shared/schema/proxy.ts`.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Mounts the SPA.
- `src/App.tsx`: Defines complete frontend route tree.
- `netlify.toml`: Rewrites `/api/*` to `/.netlify/functions/api-:splat` and `/auth/*` to `/.netlify/functions/auth-:splat`.

**Configuration:**
- `netlify.toml`: Build command, redirects, scheduled jobs.
- `vite.config.ts`: Vite config and aliasing.
- `tsconfig.json`: TypeScript compiler and path alias config.

**Core Logic:**
- `src/lib/api.ts`: Authenticated API client and error normalization.
- `netlify/functions/lib/auth.mts`: Clerk auth validation + tenant access enforcement.
- `netlify/functions/lib/access-controls.mts`: org/user/host/feature guard functions.
- `src/lib/pricing.ts`: Plan data and restrictions text catalog.

**Testing:**
- `netlify/functions/lib/*.test.ts`: Backend unit tests next to backend lib files.
- `src/lib/*.test.ts`: Frontend/lib unit tests (for example `src/lib/api.test.ts`, `src/lib/host-health-state.test.ts`).

## Naming Conventions

**Files:**
- React pages/components: PascalCase (`PricingPage.tsx`, `ProtectedRoute.tsx`).
- Backend handlers/libs: kebab-case `.mts` (`api-docker-hosts.mts`, `access-controls.mts`).
- Shared utilities: lowercase with hyphen where needed (`diagnostics.ts`, `error.ts`).

**Directories:**
- Domain and grouping folders are lowercase (`src/pages/app`, `src/components/layout`).

## Where to Add New Code

**New public route/page:**
- Implementation: `src/pages/<PageName>.tsx`
- Registration: add route in `src/App.tsx` in public section.

**New protected app screen:**
- Implementation: `src/pages/app/<PageName>.tsx`
- Registration: add nested route under `/app` in `src/App.tsx` to inherit `ProtectedRoute`.

**New API feature endpoint:**
- Handler: `netlify/functions/api-<feature>.mts`
- Shared guard/domain helper: `netlify/functions/lib/<feature>.mts`

**New frontend utility:**
- Shared client helper: `src/lib/<feature>.ts`
- Domain hook: `src/hooks/use<Feature>.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated mapping docs consumed by GSD planning/execution workflows.
- Generated: Yes.
- Committed: Yes.

**`.netlify/`:**
- Purpose: Netlify local/dev artifacts.
- Generated: Yes.
- Committed: No (typically).

**`dist/`:**
- Purpose: Frontend build output.
- Generated: Yes.
- Committed: No (typically).

## Restriction Placement Notes (Pricing Question)

- Pricing restrictions displayed at `https://dockerdash.app/pricing` are defined in `src/lib/pricing.ts` and rendered by `src/pages/PricingPage.tsx`.
- Route-level app access is enforced by `src/components/ProtectedRoute.tsx` (sign-in/onboarding/deployment), not by pricing metadata.
- Backend policy checks are invoked per endpoint through `requireAuth` in `netlify/functions/lib/auth.mts` plus specific assertions in `netlify/functions/lib/access-controls.mts`.
- Premium feature enforcement is explicit in target handlers (example: `netlify/functions/api-alert-rules.mts` calls `assertAdvancedAlertsAccessAllowed`).
- Conclusion for structure mapping: restrictions are distributed across route wrappers and endpoint guards; they are not centralized as a single sitewide pricing gate.

---

*Structure analysis: 2026-04-20*
