# External Integrations

## Authentication — Clerk

**Integration type**: OAuth/SSO provider + JWT authentication

- **Frontend**: `@clerk/clerk-react` wraps entire app in `ClerkProvider` (`src/App.tsx`)
- **Backend**: `@clerk/backend` verifies JWTs in `netlify/functions/lib/auth.mts`
- **Webhook**: Clerk user/org sync webhook at `netlify/functions/api-clerk-webhook.mts`
  - Uses Svix for webhook signature verification
  - Syncs Clerk users/orgs to local PostgreSQL tables
- **Key files**:
  - `src/App.tsx` — ClerkProvider initialization
  - `netlify/functions/lib/auth.mts` — `requireAuth()` middleware
  - `netlify/functions/lib/clerk.mts` — Clerk backend client
  - `netlify/functions/api-clerk-webhook.mts` — Webhook handler
  - `netlify/functions/auth-me.mts` — `/auth/me` endpoint returning user profile + org data

## Database — Neon PostgreSQL

**Integration type**: Serverless PostgreSQL

- **Driver**: `@neondatabase/serverless` with `sql` tagged template literal
- **Connection**: Via `DATABASE_URL` environment variable
- **Schema**: `netlify/schema.sql` (main schema, 335 lines)
- **Migrations**: `db-migrations/` directory (7 incremental SQL files)
- **Init script**: `netlify/init-db.mjs`
- **Key file**: `netlify/functions/lib/db.mts` — exports shared `sql` client

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts (synced from Clerk) |
| `organizations` | Multi-tenant workspaces |
| `organization_members` | User ↔ org membership with roles |
| `docker_hosts` | Registered Docker host connections |
| `docker_host_secrets` | Encrypted agent API keys + CF tokens |
| `agent_enrollment_sessions` | One-time agent install enrollment flow |
| `alert_rules` | User-defined alert conditions |
| `alert_events` | Triggered alert instances |
| `incidents` | Grouped alert incidents |
| `webhook_destinations` | Outbound webhook delivery targets |
| `slack_destinations` | Slack notification targets |
| `alert_delivery_attempts` | Webhook delivery audit log |
| `mock_agent_config` | Dev/test mock agent behavior |

## Billing — Paddle

**Integration type**: Payment processing (SaaS subscriptions)

- **Frontend**: Paddle.js SDK loaded via `<script>` in `index.html`, initialized in `src/App.tsx`
- **Backend**: Paddle webhook handler at `netlify/functions/api-billing-webhook.mts`
- **Key columns**: `organizations.plan`, `organizations.subscription_status`, `organizations.paddle_subscription_id`

## Watchtower Agent — Custom Docker Proxy

**Integration type**: Self-hosted agent on customer Docker hosts

The Watchtower Agent is a bash-based HTTP service that runs on customer Linux hosts. The dashboard backend proxies Docker API requests through this agent.

### Agent Communication Flow
```
Browser → Dashboard Backend → Watchtower Agent → Docker Engine (Unix socket)
```

### Agent Endpoints Called by Backend
| Endpoint | Purpose |
|----------|---------|
| `/_ping` (via `/docker/_ping`) | Docker health check |
| `/docker/version` | Docker version info |
| `/docker/containers/json` | List containers |
| `/docker/containers/{id}/json` | Container inspect |
| `/docker/containers/{id}/stats` | Container resource stats |
| `/docker/containers/{id}/logs` | Container log output |
| `/docker/containers/{id}/start` | Start container |
| `/docker/containers/{id}/stop` | Stop container |
| `/docker/containers/{id}/restart` | Restart container |
| `/agent/version` | Agent version info |
| `/metrics` | Host-level resource metrics (CPU, memory, disk, network, uptime) |

### Agent Authentication
- **X-Agent-Key** header: shared secret (AES-256-GCM encrypted at rest in `docker_host_secrets`)
- **X-Docker-Socket** header: custom Docker socket path (optional)

### Cloudflare Tunnel Mode
When `connection_mode = 'cloudflare_tunnel'`:
- Agent binds to `127.0.0.1` (localhost only)
- Traffic routed through Cloudflare Tunnel
- Optional CF Access service tokens: `CF-Access-Client-Id` + `CF-Access-Client-Secret` headers
- CF tokens encrypted at rest alongside agent API key

### Agent Files
| File | Purpose |
|------|---------|
| `public/watchtower-agent-install.sh` | Installer script (36KB) |
| `public/watchtower-agent.sh` | Runtime agent script (18KB) |
| `public/watchtower-agent-uninstall.sh` | Uninstaller script |
| `shared/watchtower-agent-release.ts` | Release metadata, command builders, version utils |
| `shared/agent-version.ts` | Version constants |

### Agent Enrollment Flow
Guided one-time enrollment to bootstrap agent on a new host:
1. Dashboard generates enrollment token + encrypted API key (`api-agent-enrollments.mts`)
2. User runs install command on host (contains enrollment token)
3. Agent calls `/api/agent-enrollments/exchange` to redeem token for API key
4. Dashboard finalizes by pinging the agent to verify connectivity

## Cloudflare (Indirect)

- **Cloudflare Tunnel**: Users configure `cloudflared` on their hosts to route traffic to the agent
- **Cloudflare Access**: Optional service token authentication layer on tunnel hostnames
- Dashboard stores and forwards CF Access tokens but does not directly integrate with Cloudflare APIs

## Outbound Webhooks

- **Webhook destinations**: Custom outbound webhooks for alert delivery
  - HMAC-SHA256 signed payloads
  - Delivery attempt tracking with audit log
  - Key file: `netlify/functions/lib/webhook-destinations.mts`
- **Slack destinations**: Slack incoming webhook integration
  - URL validated against `hooks.slack.com`
  - Key file: `netlify/functions/lib/slack-delivery.mts`

## Health Poller

- Server-side scheduled health polling at `netlify/functions/api-host-health-poll.mts`
- Periodically pings all hosts and updates `docker_hosts.status`
- Triggers alert events based on configured alert rules
