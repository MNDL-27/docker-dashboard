# Integrations

## Authentication — Clerk

**Type:** Third-party SaaS
**Used by:** Frontend (`@clerk/clerk-react`), Backend (`@clerk/backend`), Webhooks (Svix)

### Frontend Integration

- `ClerkProvider` wraps the entire app in `src/App.tsx`
- Config: `VITE_CLERK_PUBLISHABLE_KEY`
- Auth state accessed via `useAuth()` hook from Clerk
- Token retrieval: `window.Clerk?.session?.getToken()` in `src/lib/api.ts`
- Organization switching via Clerk `OrganizationSwitcher` (injects `org_id` into session token)

### Backend Integration

- `requireAuth()` in `netlify/functions/lib/auth.mts` validates Clerk JWT
- Maps Clerk user/org IDs to internal UUIDs via DB lookups
- Supports test bypass via `x-test-bypass` header in test mode
- Config: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`

### Webhook Sync

- `netlify/functions/api-clerk-webhook.mts` handles Clerk events via Svix verification
- Events handled: `user.created`, `user.updated`, `user.deleted`, `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.deleted`
- Auto-approves beta users from `beta_allowlist` table
- Config: `CLERK_WEBHOOK_SIGNING_SECRET`

## Database — Neon (PostgreSQL)

**Type:** Serverless managed PostgreSQL
**Used by:** All Netlify functions via `netlify/functions/lib/db.mts`

- Connection via `@neondatabase/serverless` using tagged template literal SQL
- Connection string: `NETLIFY_DATABASE_URL` (auto-provided by Netlify integration)
- Schema defined in `netlify/schema.sql` (6 tables + triggers)
- Schema utilities: `netlify/init-db.mjs` (bootstrap), `netlify/check-db.mjs` (verify)

### Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles synced from Clerk |
| `organizations` | Orgs synced from Clerk |
| `organization_members` | Membership with roles |
| `docker_hosts` | Registered Docker hosts per org |
| `docker_host_secrets` | Encrypted connection secrets (AES-256-GCM) |
| `mock_agent_config` | Single-row config for mock Docker agent |

## Docker Engine API (Remote Hosts)

**Type:** Self-hosted agent API on user infrastructure
**Used by:** `netlify/functions/api-docker-proxy.mts`

- The proxy function acts as a gateway between the SaaS frontend and user-managed Docker hosts
- Connection modes: `agent` (direct HTTP with API key) and `cloudflare_tunnel` (CF Access tokens)
- Secrets decrypted at runtime from `docker_host_secrets` table
- Actions: ping, info, version, containers, container-inspect/stats/logs/start/stop/restart, all-containers
- Bounded concurrency (max 5 parallel) for org-wide container fetches
- Payload size limit: 4MB; timeouts: 3–8 seconds depending on action

## Health Polling

**Type:** Cron-triggered Netlify Function
**Used by:** `netlify/functions/api-host-health-poll.mts`

- Polls all registered Docker hosts for health status
- Secured by `HEALTH_POLL_SECRET` shared secret
- Updates `docker_hosts.status`, `last_seen_at`, `consecutive_failures`, `last_error`

## Deployment — Netlify

**Type:** PaaS hosting
**Features used:**
- Static site hosting (Vite build output in `dist/`)
- Serverless functions (`netlify/functions/`)
- URL redirects (`/api/*` → functions, `/*` → SPA fallback)
- Neon database integration (auto `NETLIFY_DATABASE_URL`)
- Environment variables management

## Encryption

**Type:** Application-level (Node.js crypto)
**Used by:** `netlify/functions/lib/crypto.mts`

- AES-256-GCM with AAD binding (host ID + field name prevents ciphertext swapping)
- Key: `APP_ENCRYPTION_KEY_V1` (32 bytes, base64 or hex encoded)
- Format: `v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`
- Legacy plaintext values handled gracefully (no prefix = passthrough)
