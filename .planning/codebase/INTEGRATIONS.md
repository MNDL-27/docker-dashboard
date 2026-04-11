# Integrations

## Netlify

- Role: primary hosting/runtime platform for the dashboard.
- Used for static SPA hosting, Netlify Functions, local `netlify dev`, redirects, and environment variable delivery.
- `netlify.toml` rewrites `/api/*` to `/.netlify/functions/api-*` and `/auth/*` to `/.netlify/functions/auth-*`.
- Host-based routing distinguishes the main app domain from the docs domain.

## Clerk

- Role: authentication and identity source.
- Frontend integration:
  - `ClerkProvider` wraps the app.
  - `window.Clerk?.session?.getToken()` is used in `src/lib/api.ts` to attach bearer tokens to API calls.
  - Active organization selection in Clerk drives org-scoped backend access.
- Backend integration:
  - `requireAuth()` in `netlify/functions/lib/auth.mts` verifies Clerk tokens.
  - Clerk user/org IDs are translated to internal UUIDs from the local database.
- Webhook integration:
  - `api-clerk-webhook.mts` syncs user, organization, and membership lifecycle events into Postgres.
  - Svix is used for webhook signature verification.

## Neon Postgres

- Role: primary application database.
- Accessed through `@neondatabase/serverless` in `netlify/functions/lib/db.mts`.
- Stores:
  - app users and organizations
  - organization memberships and roles
  - docker host metadata
  - encrypted host secrets
  - mock agent state
- Schema bootstrap lives in `netlify/schema.sql`; follow-up changes live in `db-migrations/`.

## Application-Level Secret Encryption

- Role: protects host credentials at rest.
- `netlify/functions/lib/crypto.mts` encrypts `agent_api_key`, `cf_service_token_id`, and `cf_service_token_secret`.
- Encryption format is versioned and key-aware.
- AAD binds ciphertext to `(hostId, fieldName[, keyId])`, which prevents value swapping across hosts or fields.
- Secrets are decrypted only inside Netlify Functions before outbound calls to host agents.

## Watchtower Agent

- Role: host-local control plane between the dashboard and the Docker Unix socket.

### Distribution

- The agent is shipped as static assets from the dashboard repo under `public/`.
- User-facing install flows in `OnboardingPage` and `SetupGuidePage` generate:
  - `curl -fsSL <dashboard-origin>/watchtower-agent-install.sh -o watchtower-agent-install.sh`
- In production-like UI flows, the fallback origin is `https://app.dockerdash.app`.

### Installation

- `watchtower-agent-install.sh` is the supported installer for standard Linux `systemd` hosts.
- It verifies:
  - root privileges
  - `systemd`
  - `socat`, `curl`, and other shell utilities
  - existence of the Docker socket
  - that the Docker socket belongs to a non-root group so the service user can be granted access
- It creates:
  - system user/group `watchtower-agent`
  - runtime dir `/opt/watchtower-agent`
  - config dir `/etc/watchtower-agent`
  - state dir `/var/lib/watchtower-agent` by default
  - systemd unit `watchtower-agent.service`
- It stores config in `/etc/watchtower-agent/watchtower-agent.env` with `0600` permissions.
- Re-running the installer is the upgrade path; it is intentionally idempotent.

### Authentication

- The agent requires `AGENT_API_KEY`.
- The dashboard never sends host secrets back to the browser after save.
- `api-docker-hosts.mts` stores the API key and optional Cloudflare Access credentials into `docker_host_secrets` after encrypting them.
- Runtime requests from Netlify Functions to the agent include:
  - `X-Agent-Key: <agent_api_key>`
  - optional `X-Docker-Socket`
  - optional `CF-Access-Client-Id` and `CF-Access-Client-Secret`

### Reachability Modes

- `docker_hosts.connection_mode` supports:
  - `agent`
  - `cloudflare_tunnel`
- Direct mode:
  - the agent is expected to listen locally, typically `127.0.0.1:9876`
  - a reverse proxy or tunnel must expose it over HTTPS for the dashboard backend to reach it
- Cloudflare Tunnel mode:
  - the same agent remains local on the host
  - the dashboard reaches the Cloudflare hostname instead of a directly exposed host
  - optional CF Access service-token headers can be attached by the backend

### Agent API Surface

- `/docker/*`: raw Docker Engine API proxy over the local Unix socket.
- `/agent/version`: reports installed agent version, used by the dashboard for update prompts.
- `/metrics`: lightweight fleet metrics endpoint consumed by `api-fleet-metrics.mts`.

## Dashboard-To-Agent Flow

### Host registration

- UI (`AddHostDialog` or onboarding) collects host URL, connection mode, socket path, API key, and optional Cloudflare tokens.
- `useAddDockerHost()` posts to `/api/docker-hosts`.
- `api-docker-hosts.mts` inserts a `docker_hosts` row and encrypted `docker_host_secrets` row.

### Immediate validation

- After save, the UI calls `dockerApi.ping(host.id)`.
- `api-docker-proxy.mts` loads and decrypts secrets, then calls:
  - `<host_url>/docker/_ping`
  - `<host_url>/docker/version`
  - `<host_url>/agent/version`
- Successful ping updates `docker_hosts.status`, `last_seen_at`, `docker_version`, `agent_version`, and `os_info`.

### Ongoing polling

- `api-host-health-poll.mts` is protected by `x-cron-secret` / `HEALTH_POLL_SECRET`.
- It polls every registered host, updates status, increments failure counters, and marks stale/errored/unhealthy states.
- The frontend separately polls `/api/docker-hosts` every 30 seconds through React Query.

### Docker operations

- Frontend actions go through `src/services/docker-api.ts` to `/api/docker-proxy`.
- `api-docker-proxy.mts` fans out or targets a specific host for:
  - ping/info/version
  - container listing
  - inspect/stats/logs
  - start/stop/restart
- The backend enforces:
  - membership checks
  - per-action timeout budgets
  - container ID sanitization
  - 4 MB payload cap for streamed agent responses

### Fleet metrics

- `api-fleet-metrics.mts` decrypts each host’s agent API key and calls `<host_url>/metrics`.
- It aggregates host-level CPU, memory, network, and disk values into a single fleet metrics point for the dashboard.

## Mock Agent

- `api-mock-docker-agent.mts` is a built-in fake agent for local testing.
- It supports the same key paths used during connection testing:
  - `/docker/_ping`
  - `/docker/version`
  - `/agent/version`
- Its mode is stored in `mock_agent_config`.

## Paddle

- Role: billing checkout integration.
- Frontend initializes Paddle if `VITE_PADDLE_CLIENT_TOKEN` is present and opens checkout from the billing page.
