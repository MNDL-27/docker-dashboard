# Architecture

## Pattern

**Full-stack SaaS with serverless backend and agent-proxy architecture.**

The system follows a hub-and-spoke model:
- **Hub**: Cloud-hosted dashboard (Netlify) with React SPA frontend + serverless API functions
- **Spokes**: Customer-hosted Watchtower Agents running alongside Docker on each host

The dashboard backend acts as an authenticated proxy — it never connects to Docker directly. All Docker API calls go through the customer's Watchtower Agent.

## Layers

```
┌─────────────────────────────────────────────────────┐
│  Browser (React SPA)                                │
│  ├── Pages (route components)                       │
│  ├── Components (UI building blocks)                │
│  ├── Hooks (data fetching + state)                  │
│  ├── Services (API client wrappers)                 │
│  └── Lib (utilities, helpers)                       │
├─────────────────────────────────────────────────────┤
│  Netlify CDN (static assets + SPA fallback)         │
├─────────────────────────────────────────────────────┤
│  Netlify Functions (serverless API)                 │
│  ├── API handlers (~24 function files)              │
│  ├── lib/ (shared backend utilities)                │
│  └── Shared schemas (Zod, imported by both layers)  │
├─────────────────────────────────────────────────────┤
│  PostgreSQL (Neon serverless)                       │
├─────────────────────────────────────────────────────┤
│  Watchtower Agent (customer host, bash service)     │
│  └── Docker Engine (Unix socket)                    │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Read Flow (e.g., list containers)
1. Browser calls `apiFetch("/docker-proxy", { action: "containers", hostId })` via `src/lib/api.ts`
2. Netlify Function `api-docker-proxy.mts` receives request
3. Function verifies Clerk JWT via `requireAuth(req)`
4. Function looks up host + decrypts secrets from DB
5. Function builds request with auth headers (`X-Agent-Key`, optional `CF-Access-*`)
6. Function proxies to Watchtower Agent's Docker endpoint
7. Agent forwards to Docker socket, returns JSON
8. Function normalizes response, returns to browser

### Write Flow (e.g., stop container)
Same as read flow, plus:
- Requires `Idempotency-Key` header for mutations
- Checks `assertOrganizationWriteAllowed()` for write access

### Enrollment Flow (new host onboarding)
1. User fills form in browser → calls `api-agent-enrollments.mts` (POST)
2. Backend generates enrollment token + API key, encrypts, stores session
3. User runs install command on host (contains enrollment token)
4. Agent calls `/api/agent-enrollments/exchange` → gets API key + config
5. User clicks "Finish setup" → backend calls `/api/agent-enrollments/finalize`
6. Backend pings agent, updates host status, marks onboarding complete

## Key Abstractions

### Frontend
| Abstraction | Location | Purpose |
|------------|----------|---------|
| `apiFetch()` | `src/lib/api.ts` | Authenticated HTTP client (auto-injects Clerk JWT) |
| `ApiError` | `src/lib/api.ts` | Structured error with status, body, code, upstream_status |
| `ProtectedRoute` | `src/components/ProtectedRoute.tsx` | Auth gate + onboarding redirect |
| `AppShell` | `src/components/layout/AppShell.tsx` | Sidebar + content layout for `/app/*` |
| `RequireAppSubdomain` | `src/components/RequireAppSubdomain.tsx` | Subdomain enforcement |

### Backend
| Abstraction | Location | Purpose |
|------------|----------|---------|
| `requireAuth()` | `netlify/functions/lib/auth.mts` | JWT verification, user + org resolution |
| `encryptSecret()` / `decryptSecret()` | `netlify/functions/lib/crypto.mts` | AES-256-GCM envelope encryption |
| `assertOrganizationWriteAllowed()` | `netlify/functions/lib/access-controls.mts` | Org-level write permission checks |
| `buildValidatedAgentUrl()` | `netlify/functions/lib/host-url.mts` | URL validation + normalization |
| `sql` | `netlify/functions/lib/db.mts` | Tagged template SQL client (Neon) |
| `createProblemResponse()` | `shared/schema/error.ts` | RFC 7807 problem detail responses |

## Entry Points

| Entry Point | File | Description |
|------------|------|-------------|
| Frontend SPA | `src/main.tsx` → `src/App.tsx` | React app bootstrap |
| API Functions | `netlify/functions/api-*.mts` | ~24 serverless endpoints |
| Auth Webhook | `netlify/functions/api-clerk-webhook.mts` | Clerk user/org sync |
| Billing Webhook | `netlify/functions/api-billing-webhook.mts` | Paddle subscription events |
| Agent Installer | `public/watchtower-agent-install.sh` | Linux agent installation |
| Agent Runtime | `public/watchtower-agent.sh` | Agent HTTP server (bash/socat) |

## Multi-Tenancy

- **Organizations** are the tenancy boundary
- All data queries filter by `organization_id`
- Users can belong to multiple organizations via `organization_members`
- Role-based access: `owner`, `admin`, `member`
- Platform admins (by email allowlist) have cross-org access

## Subdomain Architecture

| Domain | Purpose | Behavior |
|--------|---------|----------|
| `dockerdash.app` | Marketing site | Landing, features, pricing, docs, legal pages |
| `app.dockerdash.app` | Application | Login, onboarding, dashboard, all `/app/*` routes |
| `docs.dockerdash.app` | Documentation | Full docs SPA (rewrite to `/index.html`) |
| `www.dockerdash.app` | Redirect | 301 → `dockerdash.app` |

Routing logic in `src/App.tsx` checks subdomain at render time via `isAppSubdomain()` / `isDocsSubdomain()`.
