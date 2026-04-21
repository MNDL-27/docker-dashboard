# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```text
[project-root]/
|-- src/                    # Vite React SPA source
|-- netlify/functions/      # Netlify serverless endpoints
|-- shared/                 # Cross-runtime schemas and helpers
|-- public/                 # Static assets and install scripts
|-- db-migrations/          # SQL migrations applied outside the app runtime
|-- scripts/                # Repository scripts such as release prep
|-- netlify/                # Netlify SQL snapshot and local DB helpers
|-- dist/                   # Built frontend output
|-- .planning/codebase/     # Generated codebase map documents
|-- package.json            # Scripts and dependency manifest
|-- netlify.toml            # Redirects, scheduled jobs, and build config
`-- vite.config.ts          # Frontend bundler config
```

## Directory Purposes

**`src/`:**
- Purpose: all browser application code.
- Contains: route pages, feature components, UI primitives, hooks, typed service wrappers, and browser-only utilities.
- Key files: `src/App.tsx`, `src/main.tsx`, `src/lib/api.ts`, `src/components/layout/AppShell.tsx`

**`src/pages/`:**
- Purpose: route-level screens.
- Contains: public marketing/docs pages, auth pages, onboarding screens, and app workspace pages under `src/pages/app/`.
- Key files: `src/pages/LandingPage.tsx`, `src/pages/DocsPage.tsx`, `src/pages/app/DashboardPage.tsx`, `src/pages/onboarding/index.ts`

**`src/components/`:**
- Purpose: reusable view building blocks.
- Contains: feature areas such as `src/components/dashboard/`, `src/components/alerts/`, `src/components/hosts/`, `src/components/settings/`, plus shadcn-style primitives under `src/components/ui/`.
- Key files: `src/components/ProtectedRoute.tsx`, `src/components/layout/AppShell.tsx`, `src/components/hosts/HostWorkspace.tsx`

**`src/hooks/`:**
- Purpose: React Query wrappers and UI helper hooks.
- Contains: feature hooks such as `src/hooks/useDocker.ts`, `src/hooks/useViewerState.ts`, `src/hooks/useOrganizationAccess.ts`
- Key files: `src/hooks/useDocker.ts`, `src/hooks/useAlerts.ts`, `src/hooks/useAdmin.ts`

**`src/services/`:**
- Purpose: browser-side API method wrappers.
- Contains: one service module per backend concern.
- Key files: `src/services/docker-api.ts`, `src/services/organization-access-api.ts`, `src/services/admin-api.ts`

**`src/lib/`:**
- Purpose: shared browser utilities and domain helpers.
- Contains: fetch abstraction, routing hostname utilities, summary builders, pricing helpers, health-state logic, tests for pure helpers.
- Key files: `src/lib/api.ts`, `src/lib/hostname.ts`, `src/lib/dashboard-summary.ts`

**`src/types/`:**
- Purpose: frontend-facing TypeScript type definitions.
- Contains: feature data models that match backend payloads and database rows.
- Key files: `src/types/database.ts`, `src/types/alerts.ts`, `src/types/organization-access.ts`

**`netlify/functions/`:**
- Purpose: backend HTTP entry points.
- Contains: one file per route or scheduled job, each exporting a default handler and Netlify `config.path`.
- Key files: `netlify/functions/api-docker-proxy.mts`, `netlify/functions/api-docker-hosts.mts`, `netlify/functions/auth-me.mts`, `netlify/functions/api-host-health-poll.mts`

**`netlify/functions/lib/`:**
- Purpose: shared backend helpers.
- Contains: auth, SQL access, tenant checks, admin helpers, crypto, email, alert dispatch, schema bootstrapping, tests.
- Key files: `netlify/functions/lib/db.mts`, `netlify/functions/lib/auth.mts`, `netlify/functions/lib/access-controls.mts`, `netlify/functions/lib/security.mts`

**`shared/`:**
- Purpose: code imported by both the browser and Netlify functions.
- Contains: Zod schemas, OpenAPI generation, diagnostics formatting, agent release metadata.
- Key files: `shared/schema/api.ts`, `shared/schema/proxy.ts`, `shared/lib/diagnostics.ts`, `shared/watchtower-agent-release.ts`

**`public/`:**
- Purpose: static files copied as-is into the frontend build.
- Contains: favicon/assets plus shell scripts used to install, uninstall, or connect the Watchtower agent.
- Key files: `public/watchtower-agent-install.sh`, `public/watchtower-agent.sh`, `public/watchtower-agent-uninstall.sh`

**`db-migrations/`:**
- Purpose: SQL migration history for application schema changes.
- Contains: timestamped `.sql` files grouped by migration date.
- Key files: `db-migrations/20260418000000_add_security_rate_limit_and_webhook_nonce_tables.sql`, `db-migrations/20260417010000_add_donor_billing.sql`

**`netlify/`:**
- Purpose: local platform support files, not route handlers.
- Contains: database bootstrap/check scripts and a schema snapshot.
- Key files: `netlify/schema.sql`, `netlify/init-db.mjs`, `netlify/check-db.mjs`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: browser bootstrap.
- `src/App.tsx`: frontend provider stack and all route declarations.
- `netlify/functions/auth-me.mts`: auth/session resolution endpoint used by route guards.
- `netlify/functions/api-docker-proxy.mts`: remote Docker and Watchtower agent orchestration endpoint.

**Configuration:**
- `package.json`: npm scripts and dependencies.
- `netlify.toml`: redirects, build command, scheduled jobs.
- `vite.config.ts`: Vite alias and dev-server settings.
- `tsconfig.json`: TypeScript baseline with `@/*` path alias.
- `components.json`: shadcn UI alias/config metadata.

**Core Logic:**
- `src/lib/api.ts`: authenticated frontend fetch path.
- `src/hooks/useDocker.ts`: canonical host/container data hooks.
- `netlify/functions/lib/auth.mts`: tenant-aware auth context builder.
- `netlify/functions/lib/access-controls.mts`: authorization gates.
- `netlify/functions/lib/db.mts`: Neon SQL client.

**Testing:**
- `src/lib/*.test.ts`: frontend/pure-helper tests such as `src/lib/api.test.ts` and `src/lib/host-health-state.test.ts`
- `shared/lib/*.test.ts`: shared helper tests such as `shared/lib/diagnostics.test.ts`
- `netlify/functions/lib/*.test.ts`: backend helper tests such as `netlify/functions/lib/access-controls.test.ts`

## Naming Conventions

**Files:**
- Route pages use PascalCase names with `Page` suffix, for example `src/pages/app/AlertsPage.tsx`.
- React components use PascalCase names without a `Page` suffix unless they are route entries, for example `src/components/dashboard/DashboardOverview.tsx`.
- Hooks use `useX.ts` or `use-x.tsx` naming, for example `src/hooks/useDocker.ts` and `src/hooks/use-mobile.tsx`.
- Service and helper modules use kebab-case, for example `src/services/docker-api.ts` and `netlify/functions/lib/access-controls.mts`.
- Netlify handlers use `api-*` or `auth-*` prefixes that mirror the public route, for example `netlify/functions/api-org-access-splat.mts`.

**Directories:**
- Feature areas are grouped by concern, for example `src/components/alerts/`, `src/components/dashboard/`, `src/components/settings/`.
- App-only route pages live in `src/pages/app/`; onboarding-only screens live in `src/pages/onboarding/`.
- Backend shared logic is always under `netlify/functions/lib/`, not mixed into route handler files.

## Where to Add New Code

**New frontend route/page:**
- Primary code: add the page under `src/pages/` or `src/pages/app/` depending on whether it belongs inside the protected app shell.
- Route wiring: update `src/App.tsx`.
- Supporting UI: place feature components under the closest feature folder in `src/components/`.

**New backend endpoint:**
- Implementation: add a new handler file under `netlify/functions/` named after the route, for example `netlify/functions/api-foo-bar.mts`.
- Shared backend logic: put reusable helpers in `netlify/functions/lib/`.
- Frontend caller: add a service wrapper in `src/services/` and a React Query hook in `src/hooks/` if the data is cached.

**New shared contract:**
- Validation/schema: put it in `shared/schema/` when both runtimes need it.
- Cross-runtime utility: put it in `shared/lib/`.
- Browser-only helper: keep it in `src/lib/` instead.

**New feature component/module:**
- Implementation: use the nearest feature directory under `src/components/`, for example `src/components/alerts/` for alerts UI.
- Page-level orchestration: keep it in the route page file under `src/pages/`.

**Utilities:**
- Shared browser helpers: `src/lib/`
- Shared backend helpers: `netlify/functions/lib/`
- Shared between browser and backend: `shared/lib/`

**Database changes:**
- Migration SQL: add a new timestamped file under `db-migrations/`.
- Runtime bootstrap needed by handlers: add/update an `ensure-*.mts` helper under `netlify/functions/lib/` and call it from the affected handler.

## Special Directories

**`dist/`:**
- Purpose: generated Vite build output.
- Generated: Yes.
- Committed: Yes in the current repo state.

**`.planning/codebase/`:**
- Purpose: generated architecture, stack, testing, and concern maps consumed by GSD workflows.
- Generated: Yes.
- Committed: Yes in the current repo state.

**`.netlify/` and `.netlify-appdata/`:**
- Purpose: local Netlify dev/runtime artifacts.
- Generated: Yes.
- Committed: No in normal source control workflows.

**`node_modules/`:**
- Purpose: installed package dependencies.
- Generated: Yes.
- Committed: No in normal source control workflows.

**`.obsidian-mcp-local/`:**
- Purpose: local Obsidian MCP integration files for this workspace.
- Generated: Yes.
- Committed: No in normal source control workflows.

---

*Structure analysis: 2026-04-22*
