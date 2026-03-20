# Architecture

## Pattern

**Multi-tenant SaaS with serverless backend and remote Docker host management.**

The application is a Docker container management dashboard that allows organizations to register their Docker hosts, then monitor and control containers through a centralized web UI. The backend acts as an authenticated proxy between the frontend and user-managed Docker agents.

## Layers

```
┌─────────────────────────────────────────────────────┐
│  Browser (React SPA)                                │
│  ├── Marketing pages (unauthenticated)              │
│  ├── Auth flow (Clerk-managed)                      │
│  └── App shell (authenticated, org-scoped)          │
├─────────────────────────────────────────────────────┤
│  Netlify Edge / CDN                                  │
│  ├── Static assets (Vite build → dist/)             │
│  └── URL rewrites (/api/* → functions)              │
├─────────────────────────────────────────────────────┤
│  Netlify Functions (Serverless API)                  │
│  ├── Auth middleware (Clerk JWT verification)        │
│  ├── CRUD endpoints (hosts, orgs, members, profile) │
│  ├── Docker proxy (gateway to remote agents)        │
│  ├── Clerk webhook handler (user/org sync)          │
│  └── Health poller (cron-triggered)                 │
├─────────────────────────────────────────────────────┤
│  Neon PostgreSQL (Serverless)                        │
│  └── 6 tables: users, organizations, org_members,   │
│      docker_hosts, docker_host_secrets, mock_config  │
├─────────────────────────────────────────────────────┤
│  Remote Docker Hosts (User Infrastructure)           │
│  └── Docker agents exposing Docker Engine API        │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow
1. User signs in/up via Clerk UI on `LoginPage`
2. Clerk webhooks fire → `api-clerk-webhook.mts` syncs user/org to Neon
3. `ProtectedRoute` checks Clerk auth state + calls `/api/auth/me` for beta approval + org status
4. Unapproved → `/beta-gate`; No org → `/onboarding`; Has org → `/app`

### Docker Proxy Flow
1. Frontend calls `dockerApi.*()` via `src/services/docker-api.ts`
2. `apiFetch()` in `src/lib/api.ts` attaches Clerk Bearer token
3. Netlify redirects `/api/docker-proxy` → `api-docker-proxy.mts`
4. Function: verifies auth → loads host + secrets from DB → decrypts secrets → builds request → proxies to remote Docker agent → returns response
5. For `all-containers`: fetches from all org hosts concurrently (max 5 parallel)

### Health Polling Flow
1. Cron job triggers `api-host-health-poll.mts`
2. Validates `HEALTH_POLL_SECRET`
3. Fetches all hosts from DB, pings each, updates status/failures/last_seen

## Key Abstractions

### Frontend
- **`apiFetch()`** (`src/lib/api.ts`) — Centralized fetch wrapper that injects Clerk tokens and handles error parsing
- **`dockerApi`** (`src/services/docker-api.ts`) — Type-safe Docker API client wrapping `apiFetch`
- **`useDocker*` hooks** (`src/hooks/useDocker.ts`) — TanStack Query wrappers with polling intervals
- **`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`) — Multi-level auth gate (Clerk → beta approval → onboarding → app)

### Backend
- **`requireAuth()`** (`netlify/functions/lib/auth.mts`) — Auth middleware returning `AppAuthContext` with internal UUIDs
- **`encryptSecret()` / `decryptSecret()`** (`netlify/functions/lib/crypto.mts`) — AES-256-GCM with AAD binding
- **`sql`** (`netlify/functions/lib/db.mts`) — Neon tagged template SQL client

## Multi-Tenancy

- Organization-scoped: Docker hosts belong to organizations
- Membership-gated: API access verified via `organization_members` join
- Clerk `OrganizationSwitcher` injects active `org_id` into session token
- Backend resolves Clerk org ID → internal UUID for all queries

## Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| SPA entry | `src/main.tsx` → `src/App.tsx` | React app bootstrap |
| HTML shell | `index.html` | Vite entry with SEO meta tags |
| API endpoints | `netlify/functions/api-*.mts` | Each file = one serverless function |
| Webhook | `netlify/functions/api-clerk-webhook.mts` | Clerk event handler |
| Auth check | `netlify/functions/auth-me.mts` | Session validation endpoint |
| DB schema | `netlify/schema.sql` | Database initialization |
