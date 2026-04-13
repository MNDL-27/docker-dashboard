# Architecture

## System Shape

Docker Watchtower Dashboard is a multi-tenant React SPA backed by Netlify Functions and Neon Postgres. The browser never talks to Docker directly. Every host operation goes through a server-side control plane that:

- authenticates the user with Clerk
- resolves the active Clerk organization to an internal Neon UUID
- loads host metadata from `docker_hosts`
- decrypts per-host secrets from `docker_host_secrets`
- calls a remote Watchtower agent over HTTPS or Cloudflare Tunnel
- lets that agent proxy requests into the local Docker Unix socket

The core architectural boundary is:

- Frontend owns workflow, routing, and polling UX
- Netlify Functions own auth, tenancy, secret handling, and proxy orchestration
- Watchtower agent owns host-local Docker access
- Neon owns persistent fleet metadata and encrypted secret blobs

## Runtime Layers

```text
Browser SPA
  -> React Router + Clerk session + React Query polling
  -> /api/* fetches with Bearer token

Netlify Edge/CDN
  -> serves Vite bundle from dist/
  -> rewrites /api/* to Netlify functions
  -> rewrites docs subdomain to SPA entry

Netlify Functions
  -> requireAuth() verifies Clerk request and resolves internal user/org ids
  -> host CRUD stores metadata + encrypted secrets
  -> docker proxy and health poll decrypt secrets and contact host agents
  -> fleet metrics aggregates host-side metrics

Neon Postgres
  -> users
  -> organizations
  -> organization_members
  -> docker_hosts
  -> docker_host_secrets
  -> mock_agent_config

Remote Host
  -> watchtower-agent.sh or installed runtime
  -> validates X-Agent-Key
  -> optionally honors X-Docker-Socket override
  -> proxies /docker/* to Docker over Unix socket
  -> exposes /agent/version and /metrics

Docker Engine
  -> /_ping, /version, /containers/*, /stats, /logs, lifecycle actions
```

## End-to-End Watcher Flow

### 1. Frontend setup and route entry

- `src/App.tsx` composes the app shell, subdomain-aware routing, Clerk, and React Query.
- Product routes live under `/app` and are wrapped by `ProtectedRoute`, which depends on Clerk session state plus `/api/auth/me`.
- Setup UX is split between:
  - `src/pages/OnboardingPage.tsx` for first-run org + host setup
  - `src/components/docker/AddHostDialog.tsx` for later host registration
  - `src/pages/app/SetupGuidePage.tsx` for install docs and generated installer command

### 2. Host registration

- `OnboardingPage` and `AddHostDialog` collect:
  - `name`
  - `host_url`
  - `connection_mode` (`agent` or `cloudflare_tunnel`)
  - `docker_socket_path`
  - `agentApiKey`
  - optional CF Access service tokens
- Both call `useAddDockerHost()` in `src/hooks/useDocker.ts`.
- `useAddDockerHost()` posts to `/api/docker-hosts` through `apiFetch()` in `src/lib/api.ts`, which attaches the Clerk Bearer token.

### 3. Auth and tenancy resolution

- `netlify/functions/lib/auth.mts` uses Clerk backend auth to verify the request.
- The function resolves:
  - Clerk user id -> internal `users.id`
  - Clerk org id -> internal `organizations.id`
- Backend code consistently uses the resolved internal org id, even if the frontend sent a Clerk org id in the JSON body.

### 4. Encrypted secret storage

- `netlify/functions/api-docker-hosts.mts` inserts host metadata into `docker_hosts`.
- It encrypts secrets before persistence using `encryptSecret()` from `netlify/functions/lib/crypto.mts`.
- Secret rows are stored separately in `docker_host_secrets`, not alongside host metadata.
- Encryption uses AES-256-GCM with:
  - per-secret random IVs
  - auth tags
  - AAD binding to host id and field name
  - keyed ciphertext format `v2:<keyId>:...`
- Active key selection comes from:
  - `APP_ENCRYPTION_ACTIVE_KEY_ID`
  - `APP_ENCRYPTION_KEY_<KEY_ID>`
- Legacy fallback for `APP_ENCRYPTION_KEY_V1` is still supported for decryption/migration.
- `api-admin-migrate-secrets.mts` exists for re-encrypting old stored values after key rotation.

### 5. Immediate connection test

- After save, the frontend immediately calls `dockerApi.ping(host.id)`.
- `src/services/docker-api.ts` routes all host actions through `/api/docker-proxy`.
- `netlify/functions/api-docker-proxy.mts`:
  - validates auth and org membership
  - loads host record
  - loads encrypted secrets
  - decrypts them with `decryptHostSecrets()`
  - builds request headers:
    - `X-Agent-Key`
    - optional `X-Docker-Socket`
    - optional Cloudflare Access headers
  - sends `GET {host_url}/docker/_ping`
- For ping specifically, the proxy also fetches:
  - `{host_url}/docker/version`
  - `{host_url}/agent/version`
- The function updates `docker_hosts.status`, `last_seen_at`, `docker_version`, `agent_version`, and `os_info`.

### 6. Netlify proxy to agent

- `netlify.toml` rewrites `/api/*` to `/.netlify/functions/api-*`.
- The frontend only knows `/api/docker-proxy`, `/api/docker-hosts`, `/api/fleet-metrics`, and similar routes.
- Secret material never returns to the browser after save. Secrets are only decrypted inside Netlify Functions immediately before outbound host requests.

### 7. Watchtower agent behavior

- `public/watchtower-agent.sh` is the standalone runtime.
- `public/watchtower-agent-install.sh` installs an idempotent systemd-managed runtime under:
  - `/opt/watchtower-agent/watchtower-agent.sh`
  - `/etc/watchtower-agent/watchtower-agent.env`
- The agent:
  - requires `AGENT_API_KEY`
  - listens via `socat`
  - validates `X-Agent-Key`
  - supports `X-Docker-Socket` override
  - exposes `/agent/version`
  - exposes `/metrics`
  - proxies `/docker/*` requests to Docker over the Unix socket via `curl --unix-socket`

### 8. Docker socket access

- The agent never opens Docker TCP remotely.
- Instead, it translates incoming HTTP calls into local Unix-socket requests such as:
  - `/_ping`
  - `/version`
  - `/containers/json`
  - `/containers/{id}/stats?stream=false`
  - `/containers/{id}/logs`
  - lifecycle actions like `start`, `stop`, `restart`
- Socket path defaults to `/var/run/docker.sock` but can be overridden per host and passed through Netlify to the agent in `X-Docker-Socket`.

### 9. Host metrics and status updates

- `netlify/functions/api-host-health-poll.mts` is the scheduled fleet health checker.
- It requires `x-cron-secret` matching `HEALTH_POLL_SECRET`.
- It pings every host directly from Netlify Functions, decrypting secrets per host first.
- On success it updates:
  - `status = connected`
  - `last_seen_at`
  - `consecutive_failures = 0`
  - `last_error = null`
  - `docker_version`
  - `agent_version`
  - `os_info`
- On failure it increments `consecutive_failures`, stores `last_error`, and escalates to `error` or `unhealthy`.
- `api-docker-hosts.mts` also marks previously connected hosts as `stale` when `last_seen_at` crosses the configured threshold.

- `netlify/functions/api-fleet-metrics.mts` separately aggregates fleet telemetry.
- For each org host it:
  - decrypts `agent_api_key`
  - calls `{host_url}/metrics`
  - normalizes host CPU, memory, network, and disk rates
  - returns a fleet-wide point consumed by `src/hooks/useFleetMetrics.ts`

## Key Components

### Frontend control plane

- `src/lib/api.ts`: authenticated browser-to-Netlify fetch wrapper
- `src/services/docker-api.ts`: typed host action client
- `src/hooks/useDocker.ts`: React Query host/container CRUD and polling
- `src/hooks/useFleetMetrics.ts`: React Query wrapper for aggregated fleet metrics

### Backend control plane

- `netlify/functions/lib/auth.mts`: Clerk request verification and org resolution
- `netlify/functions/lib/crypto.mts`: AES-256-GCM secret encryption/decryption and rotation support
- `netlify/functions/api-docker-hosts.mts`: host CRUD and secret persistence
- `netlify/functions/api-docker-proxy.mts`: runtime host action gateway
- `netlify/functions/api-host-health-poll.mts`: scheduled host status updater
- `netlify/functions/api-fleet-metrics.mts`: fleet metrics fan-out and aggregation

### Host runtime

- `public/watchtower-agent.sh`: host-local HTTP shim over Docker Unix socket
- `public/watchtower-agent-install.sh`: supported install/update path and embedded runtime template
- `shared/watchtower-agent-release.ts`: canonical source for all release metadata (`CURRENT_WATCHTOWER_AGENT_RELEASE`), install command builders, and `buildWatchtowerAgentUpdateCopy()` for generating all upgrade dialog copy centrally
- `shared/agent-version.ts`: backward-compat shim that re-exports from `watchtower-agent-release.ts` and also exports `CURRENT_WATCHTOWER_AGENT_VERSION` for older consumers
- `src/lib/agent-release.ts`: frontend-side barrel re-export from `watchtower-agent-release.ts`
- `netlify/functions/lib/agent-version.mts`: canonical agent version comparison on the backend

## Multi-Tenancy and Security Notes

- Tenant isolation is organization-based and enforced server-side with `organization_members`.
- The browser never receives stored secrets back after creation.
- Host secrets are scoped cryptographically to host id and field name through AAD.
- Connection mode only changes outbound headers and network path:
  - `agent`: direct HTTPS to the host agent
  - `cloudflare_tunnel`: same agent, plus optional CF Access headers

## Architecture Notes to Keep in Mind

- This repo is no longer using the older simple JWT model described in stale docs; the active auth layer is Clerk.
- Fleet metrics do not go through `/api/docker-proxy`; they fan out from a dedicated function directly to each agent `/metrics` endpoint after decrypting secrets server-side.
- The "watcher" is effectively a chain of browser setup, Netlify orchestration, encrypted host credential handling, and a host-local shell agent rather than a persistent backend worker.
