# Structure

## Top-Level Layout

```text
docker-watchtower-dash/
├── src/                     Frontend SPA
├── netlify/                 Netlify functions, schema, DB scripts
├── public/                  Static assets and host agent/install scripts
├── shared/                  Cross-runtime shared constants
├── db-migrations/           Incremental SQL migrations
├── .planning/codebase/      Codebase map documents
├── dist/                    Vite build output
├── netlify.toml             Netlify build + rewrite rules
├── package.json             Scripts and dependency graph
└── README.md                Setup and operational docs
```

## Frontend Structure

### `src/App.tsx`

Primary composition root:

- initializes Clerk
- initializes React Query
- wires React Router
- routes app vs docs vs marketing by hostname
- mounts authenticated `/app` shell

This is the entry point for understanding how setup routes lead into the watcher flow.

### `src/pages/`

Main page groups:

- public marketing and legal pages
- `OnboardingPage.tsx` for org creation + first host registration
- `LoginPage.tsx` and `SignupPage.tsx`
- `DocsPage.tsx` and operational docs surfaces

### `src/pages/app/`

Authenticated product pages:

- `DashboardPage.tsx`
- `HostsPage.tsx`
- `HostDetailPage.tsx`
- `ContainersPage.tsx`
- `ContainerDetailPage.tsx`
- `SetupGuidePage.tsx`
- `AdminPage.tsx`

Watcher-relevant pages:

- `HostsPage.tsx` shows registered hosts and connection state
- `HostDetailPage.tsx` shows agent version and status details
- `SetupGuidePage.tsx` explains install and exposure patterns
- `DashboardPage.tsx` consumes fleet metrics and health summaries

### `src/components/docker/`

- `AddHostDialog.tsx` is the reusable host registration UI outside onboarding

This is the most important frontend component for the host registration path.

### `src/hooks/`

Key hooks:

- `useDocker.ts`
  - host list query
  - add/delete host mutations
  - container and stats polling
- `useFleetMetrics.ts`
  - fetches aggregated org-level metrics from `/api/fleet-metrics`
- `useViewerState.ts`
  - auth/viewer profile state

### `src/services/`

- `docker-api.ts` is the typed browser API client for host actions routed through `/api/docker-proxy`

### `src/lib/`

Key utilities:

- `api.ts`: browser fetch wrapper that injects Clerk token
- `hostname.ts`: subdomain detection
- `host-health-state.ts`: UI state helpers for host freshness/status
- `onboarding-gate.ts`: onboarding state derivation
- `agent-version.ts`: current-version comparison logic for UI prompts

### `src/types/`

- `database.ts` contains the app-facing TypeScript shapes for `DockerHost`, `Organization`, and related entities

## Backend Structure

### `netlify/functions/`

This folder is the server-side control plane. Each file is a Netlify function exposed through `netlify.toml`.

#### Auth and user state

- `auth-me.mts`
- `api-profile.mts`
- `api-members.mts`
- `api-organizations.mts`
- `api-clerk-webhook.mts`

#### Host and watcher control plane

- `api-docker-hosts.mts`
  - host CRUD
  - onboarding completion side effects
  - encrypted secret writes to `docker_host_secrets`
- `api-docker-proxy.mts`
  - host-scoped Docker action proxy
  - org-wide container fan-out
  - ping/version enrichment and host status updates
- `api-host-health-poll.mts`
  - scheduled health poller
  - status/error/staleness lifecycle
- `api-fleet-metrics.mts`
  - org-wide host metrics aggregation
- `api-admin-migrate-secrets.mts`
  - re-encrypts stored host secrets using the active key
- `api-mock-docker-agent.mts`
  - local/dev agent substitute

#### Billing/admin utilities

- `api-billing-webhook.mts`
- `api-admin-stats.mts`

### `netlify/functions/lib/`

Core server-side helpers:

- `auth.mts`
  - Clerk request verification
  - internal user/org resolution
- `db.mts`
  - Neon SQL client
- `crypto.mts`
  - host secret encryption/decryption
  - key rotation support
- `host-health.mjs`
  - stale/unhealthy state transitions
- `agent-version.mts`
  - canonical agent version comparison
- `ensure-onboarding-schema.mts`
  - compatibility guard for onboarding-related columns/tables
- `platform-admin.mts`
  - admin authorization helper

## Host Runtime Structure

### `public/watchtower-agent.sh`

Standalone agent runtime. Responsibilities:

- validate local env and dependencies
- accept inbound HTTP over `socat`
- authenticate `X-Agent-Key`
- optionally switch Docker socket path via `X-Docker-Socket`
- expose `/agent/version`
- expose `/metrics`
- proxy `/docker/*` to Docker Unix socket

### `public/watchtower-agent-install.sh`

Production install/update entry point. Responsibilities:

- preflight checks
- create service account and directories
- write env file and systemd service
- embed current runtime script
- install uninstaller
- restart and validate service

### `public/watchtower-agent-uninstall.sh`

Cleanup path for installed agent service.

### `public/watchtower-dev-connector.sh`

Legacy shim pointing users toward the supported installer/runtime flow.

## Shared and Schema Structure

### `shared/`

- `agent-version.ts`

Shared current-version constant to keep UI and functions aligned on upgrade prompts.

### `netlify/schema.sql`

Canonical base schema. Watcher-relevant tables:

- `docker_hosts`
  - host metadata, status, versions, last seen, failure counters
- `docker_host_secrets`
  - encrypted API key and optional Cloudflare credentials
- `organization_members`
  - tenant access enforcement
- `organizations`
  - onboarding state

### `db-migrations/`

Current notable watcher-related migrations:

- `20260404000000_add_agent_version_to_docker_hosts.sql`
- earlier migrations for billing foundation and beta allowlist

## Runtime Path by File

```text
src/App.tsx
  -> src/pages/OnboardingPage.tsx or src/components/docker/AddHostDialog.tsx
  -> src/hooks/useDocker.ts
  -> src/lib/api.ts
  -> /api/docker-hosts
  -> netlify/functions/api-docker-hosts.mts
  -> netlify/functions/lib/auth.mts
  -> netlify/functions/lib/crypto.mts
  -> netlify/schema.sql tables: docker_hosts + docker_host_secrets

save-and-test continues:
  -> src/services/docker-api.ts ping()
  -> /api/docker-proxy
  -> netlify/functions/api-docker-proxy.mts
  -> decrypted host secrets + request header construction
  -> remote {host_url}/docker/_ping and /agent/version
  -> public/watchtower-agent.sh
  -> local Docker Unix socket
  -> docker_hosts status/version updates

ongoing status:
  -> /api/host-health-poll
  -> netlify/functions/api-host-health-poll.mts
  -> host ping + version fan-out
  -> docker_hosts health transitions

ongoing metrics:
  -> src/hooks/useFleetMetrics.ts
  -> /api/fleet-metrics
  -> netlify/functions/api-fleet-metrics.mts
  -> remote {host_url}/metrics
  -> public/watchtower-agent.sh
  -> Docker stats aggregation
  -> dashboard charts/cards
```

## Structure Notes / Drift From Older Map

- Older structure docs referenced custom JWT auth and empty `contexts/`; current auth is Clerk-driven and server-side org resolution is central.
- The host agent is a first-class part of the repo now and belongs in the structure map, not just README docs.
- The watcher flow is split across two different backend paths:
  - `/api/docker-proxy` for interactive host/container actions
  - `/api/host-health-poll` and `/api/fleet-metrics` for scheduled and aggregate updates
