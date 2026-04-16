# Directory Structure

## Root Layout

```
docker-watchtower-dash/
├── src/                        # Frontend React application
├── netlify/                    # Backend serverless functions + DB
│   ├── functions/              # Netlify Function handlers
│   │   └── lib/                # Shared backend utilities
│   ├── schema.sql              # Main database schema
│   ├── init-db.mjs             # DB initialization script
│   └── check-db.mjs            # DB verification script
├── shared/                     # Code shared between frontend & backend
│   ├── schema/                 # Zod schemas (API, error, proxy)
│   ├── watchtower-agent-release.ts  # Agent release metadata + command builders
│   └── agent-version.ts        # Agent version constants
├── public/                     # Static assets served by Vite/Netlify
│   ├── watchtower-agent-install.sh  # Agent installer (36KB)
│   ├── watchtower-agent.sh     # Agent runtime (18KB)
│   └── watchtower-agent-uninstall.sh # Agent uninstaller
├── db-migrations/              # Incremental SQL migration files
├── scripts/                    # Build/release helper scripts
├── .planning/                  # GSD planning artifacts
├── .agent/                     # Agent skill configurations
├── .clean-test/                # Manual test/verification scripts
└── dist/                       # Build output (gitignored)
```

## Frontend (`src/`)

```
src/
├── main.tsx                    # App bootstrap (renders App into #root)
├── App.tsx                     # Router, providers, lazy-loaded pages
├── App.css                     # App-level styles
├── index.css                   # Global CSS + design token variables
├── vite-env.d.ts               # Vite type declarations + Paddle global
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, input, dialog, etc.)
│   │   └── LoginBackground.tsx # Three.js animated login background
│   ├── layout/                 # App shell, sidebar, header
│   ├── dashboard/              # Dashboard-specific components
│   │   ├── KPICard.tsx         # Summary metric cards
│   │   ├── FleetResourceChart.tsx  # Fleet-level resource charts
│   │   ├── HostHealthGrid.tsx  # Host status overview grid
│   │   ├── ContainersTable.tsx # Recent containers table
│   │   ├── DashboardOverview.tsx   # Dashboard layout orchestrator
│   │   ├── DashboardAlerts.tsx     # Dashboard alert section
│   │   └── DashboardEmptyHostsState.tsx / DashboardNoOrganizationState.tsx
│   ├── hosts/
│   │   └── HostWorkspace.tsx   # Host detail view (52KB, largest component)
│   ├── docker/                 # Docker-specific UI components
│   ├── alerts/                 # Alert rule/event UI components
│   ├── settings/               # Settings page components
│   ├── shared/                 # Cross-cutting UI (PageHeader, LogoLink, etc.)
│   ├── ProtectedRoute.tsx      # Auth gate with onboarding detection
│   ├── AppRootRedirect.tsx     # Root path redirect logic
│   ├── RequireAppSubdomain.tsx # Subdomain enforcement
│   ├── RequirePlatformAdmin.tsx# Platform admin gate
│   └── NavLink.tsx             # Active navigation link
├── pages/
│   ├── LandingPage.tsx         # Marketing homepage
│   ├── FeaturesPage.tsx        # Features page
│   ├── PricingPage.tsx         # Pricing page
│   ├── SecurityPage.tsx        # Security page
│   ├── DocsPage.tsx            # Documentation (58KB, inline docs)
│   ├── LoginPage.tsx           # Clerk login
│   ├── SignupPage.tsx          # Clerk signup
│   ├── OnboardingPage.tsx      # Onboarding wizard orchestrator
│   ├── onboarding/             # Onboarding step components
│   │   ├── useOnboardingState.ts   # Onboarding state machine (398 lines)
│   │   ├── StepCreateOrg.tsx       # Step 0: Create organization
│   │   ├── StepHostBasics.tsx      # Step 1a: Host name + URL + connection mode
│   │   ├── StepHostCredentials.tsx # Step 1b: Install command + verification
│   │   ├── StepTestFailed.tsx      # Step 1c: Connection test failure UI
│   │   ├── StepComplete.tsx        # Step 2: Success state
│   │   ├── CopyBlock.tsx           # Copy-to-clipboard code block
│   │   ├── ErrorBanner.tsx         # Error display banner
│   │   └── LoadingCard.tsx         # Loading state card
│   └── app/                    # Protected app routes (inside AppShell)
│       ├── DashboardPage.tsx   # Main dashboard
│       ├── HostsPage.tsx       # Hosts list (thin wrapper)
│       ├── HostDetailPage.tsx  # Host detail (thin wrapper)
│       ├── ContainersPage.tsx  # All containers across hosts (23KB)
│       ├── ContainerDetailPage.tsx # Container inspect/logs/env/network (20KB)
│       ├── LogsPage.tsx        # Cross-host log viewer
│       ├── AlertsPage.tsx      # Alert rules + events management (13KB)
│       ├── MembersPage.tsx     # Org member management
│       ├── OrganizationsPage.tsx # Org switcher
│       ├── BillingPage.tsx     # Paddle billing management (13KB)
│       ├── SettingsPage.tsx    # Org settings
│       ├── AdminPage.tsx       # Platform admin panel (41KB)
│       ├── SetupGuidePage.tsx  # Agent setup documentation (16KB)
│       └── HelpPage.tsx        # Help/support page
├── hooks/                      # Custom React hooks
│   ├── useDocker.ts            # Docker proxy API calls
│   ├── useHostMetrics.ts       # Host metrics polling (10KB)
│   ├── useFleetMetrics.ts      # Fleet-wide metrics aggregation
│   ├── useAlerts.ts            # Alert rules/events hooks
│   ├── useAdmin.ts             # Platform admin hooks
│   ├── useOrganizationAccess.ts# Org access management
│   ├── useWebhookDestinations.ts # Webhook destination CRUD
│   ├── useSlackDestinations.ts # Slack destination CRUD
│   ├── useViewerState.ts       # Current user viewer state
│   ├── use-toast.ts            # Toast notification hook
│   └── use-mobile.tsx          # Mobile viewport detection
├── services/                   # API client layer
│   ├── docker-api.ts           # Docker proxy service
│   ├── agent-enrollment.ts     # Agent enrollment API
│   ├── admin-api.ts            # Admin API calls
│   ├── alerts-api.ts           # Alerts API calls
│   ├── organization-access-api.ts # Org access API
│   ├── webhook-destinations-api.ts # Webhook API
│   └── slack-destinations-api.ts   # Slack API
├── types/                      # TypeScript type definitions
│   ├── database.ts             # Database row types (186 lines)
│   ├── admin.ts                # Admin-specific types
│   ├── alerts.ts               # Alert types
│   └── organization-access.ts  # Org access types
├── lib/                        # Utilities
│   ├── api.ts                  # apiFetch() + ApiError class
│   ├── hostname.ts             # Subdomain detection utilities
│   ├── onboarding-gate.ts      # Onboarding status logic
│   ├── dashboard-summary.ts    # Dashboard data aggregation
│   ├── host-health-state.ts    # Host health state derivation
│   ├── agent-release.ts        # Frontend re-export of agent release utils
│   ├── agent-version.ts        # Frontend re-export of agent version
│   └── utils.ts                # Tailwind utility (cn)
└── contexts/                   # React contexts (currently empty)
```

## Backend (`netlify/functions/`)

```
netlify/functions/
├── api-docker-proxy.mts        # Docker commands proxy (29KB, largest function)
├── api-agent-enrollments.mts   # Agent enrollment flow (21KB)
├── api-docker-hosts.mts        # Host CRUD operations (10KB)
├── api-fleet-metrics.mts       # Fleet-wide metrics aggregation (8KB)
├── api-host-health-poll.mts    # Scheduled host health checks (9KB)
├── api-organizations.mts       # Org CRUD + onboarding status (7KB)
├── api-clerk-webhook.mts       # Clerk user/org sync webhook (6KB)
├── api-billing-webhook.mts     # Paddle billing webhook (4KB)
├── api-admin-splat.mts         # Admin API catch-all route
├── api-admin-stats.mts         # Platform-wide statistics
├── api-admin.mts               # Admin API entry
├── api-alert-rules.mts         # Alert rule CRUD (4KB)
├── api-alerts.mts              # Alert events (4KB)
├── api-incidents.mts           # Incident management (3KB)
├── api-webhook-destinations.mts# Webhook destination management (3KB)
├── api-slack-destinations.mts  # Slack destination management (3KB)
├── api-mock-docker-agent.mts   # Dev mock agent (2KB)
├── api-members.mts             # Org member management
├── api-org-access.mts          # Org access management
├── api-profile.mts             # User profile
├── api-docs.mts                # API documentation endpoint
├── auth-me.mts                 # Auth verification + user profile
└── lib/
    ├── auth.mts                # requireAuth() middleware (6KB)
    ├── crypto.mts              # AES-256-GCM encryption (8KB)
    ├── db.mts                  # Database client export
    ├── host-url.mts            # URL validation + normalization (5KB)
    ├── access-controls.mts     # Permission checks (5KB)
    ├── alerts.mts              # Alert processing logic (21KB)
    ├── admin-handler.mts       # Admin route handler (32KB)
    ├── org-access-handler.mts  # Org access route handler (12KB)
    ├── webhook-destinations.mts# Webhook delivery logic (12KB)
    ├── slack-delivery.mts      # Slack delivery logic (14KB)
    ├── ensure-*.mts            # Schema migration helpers (5 files)
    ├── platform-admin.mts      # Platform admin check
    └── secret-migration.mts    # Secret encryption migration
```

## Naming Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Pages | PascalCase + `Page` suffix | `DashboardPage.tsx` |
| Components | PascalCase | `KPICard.tsx`, `HostHealthGrid.tsx` |
| Hooks | camelCase with `use` prefix | `useDocker.ts`, `useHostMetrics.ts` |
| Services | kebab-case + `-api` suffix | `docker-api.ts`, `alerts-api.ts` |
| API Functions | `api-` prefix + kebab-case | `api-docker-proxy.mts` |
| Types | PascalCase interfaces/types | `DockerHost`, `AlertRule` |
| Lib utilities | kebab-case | `host-health-state.ts` |

## Key Locations

| What | Where |
|------|-------|
| Main entry | `src/main.tsx` |
| Route definitions | `src/App.tsx` |
| API client | `src/lib/api.ts` |
| Database types | `src/types/database.ts` |
| Database schema | `netlify/schema.sql` |
| Agent release info | `shared/watchtower-agent-release.ts` |
| Agent installer | `public/watchtower-agent-install.sh` |
| Design tokens | `src/index.css` (CSS custom properties) |
| Tailwind config | `tailwind.config.ts` |
