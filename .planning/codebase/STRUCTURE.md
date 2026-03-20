# Structure

## Directory Layout

```
docker-watchtower-dash/
├── netlify/                        # Backend (serverless)
│   ├── functions/                  # Netlify Functions (API endpoints)
│   │   ├── lib/                    # Shared backend utilities
│   │   │   ├── auth.mts            # Clerk JWT verification + auth context
│   │   │   ├── crypto.mts          # AES-256-GCM encrypt/decrypt
│   │   │   └── db.mts              # Neon database client
│   │   ├── api-clerk-webhook.mts   # Clerk webhook event handler
│   │   ├── api-docker-hosts.mts    # Host CRUD (GET/POST/DELETE)
│   │   ├── api-docker-proxy.mts    # Docker Engine API proxy (320 lines)
│   │   ├── api-host-health-poll.mts# Cron health checker
│   │   ├── api-members.mts         # Organization members
│   │   ├── api-organizations.mts   # Organization management
│   │   ├── api-profile.mts         # User profile
│   │   ├── api-admin-stats.mts     # Admin statistics
│   │   ├── api-admin-migrate-secrets.mts # Secret migration utility
│   │   ├── api-mock-docker-agent.mts # Mock agent for testing
│   │   └── auth-me.mts            # Auth session check
│   ├── schema.sql                  # Database schema (PostgreSQL)
│   ├── init-db.mjs                 # Schema bootstrap script
│   └── check-db.mjs               # DB connection verify script
├── src/                            # Frontend source
│   ├── App.tsx                     # Root component + routing
│   ├── main.tsx                    # React entry point
│   ├── index.css                   # Global styles + CSS custom properties
│   ├── App.css                     # App-level styles
│   ├── components/                 # React components
│   │   ├── ui/                     # shadcn/ui primitives (~50 files)
│   │   │   └── LoginBackground.tsx # Three.js particle background
│   │   ├── layout/                 # App shell components
│   │   │   ├── AppShell.tsx        # Sidebar + content layout
│   │   │   ├── AppSidebar.tsx      # Navigation sidebar
│   │   │   └── AppTopBar.tsx       # Top bar with org switcher
│   │   ├── docker/                 # Docker-specific components
│   │   │   └── AddHostDialog.tsx   # Host creation form dialog
│   │   ├── shared/                 # Reusable business components
│   │   │   ├── EmptyState.tsx      # Empty state placeholder
│   │   │   ├── MetricCard.tsx      # Dashboard metric card
│   │   │   ├── PageHeader.tsx      # Page header with title/actions
│   │   │   └── StatusBadge.tsx     # Status indicator badge
│   │   ├── settings/               # Settings components
│   │   │   └── ProfileSettings.tsx # Profile settings (placeholder)
│   │   ├── NavLink.tsx             # Navigation link component
│   │   └── ProtectedRoute.tsx      # Auth/onboarding gate
│   ├── hooks/                      # Custom React hooks
│   │   ├── useDocker.ts            # Docker host/container queries & mutations
│   │   ├── use-toast.ts            # Toast notification hook
│   │   └── use-mobile.tsx          # Mobile viewport detection
│   ├── services/                   # API service layers
│   │   └── docker-api.ts           # Docker API client (typed actions)
│   ├── lib/                        # Utilities
│   │   ├── api.ts                  # apiFetch() — Clerk-authenticated fetch wrapper
│   │   └── utils.ts                # cn() utility (clsx + tailwind-merge)
│   ├── types/                      # TypeScript type definitions
│   │   └── database.ts             # Organization, DockerHost, OrgMember types
│   ├── contexts/                   # React contexts (empty — unused)
│   ├── test/                       # Test infrastructure
│   │   ├── setup.ts                # Vitest setup (jsdom matchers)
│   │   └── example.test.ts         # Placeholder test
│   └── pages/                      # Page components
│       ├── LandingPage.tsx         # Marketing homepage
│       ├── FeaturesPage.tsx        # Features page
│       ├── PricingPage.tsx         # Pricing page
│       ├── SecurityPage.tsx        # Security page
│       ├── DocsPage.tsx            # Documentation page
│       ├── ContactPage.tsx         # Contact page
│       ├── LoginPage.tsx           # Clerk sign-in page
│       ├── SignupPage.tsx          # Redirects to /login
│       ├── BetaGatePage.tsx        # Beta approval waiting gate
│       ├── OnboardingPage.tsx      # Onboarding wizard (org + host setup)
│       ├── Index.tsx               # Redirects to /
│       ├── NotFound.tsx            # 404 page
│       └── app/                    # Authenticated app pages
│           ├── DashboardPage.tsx   # Main dashboard with metrics
│           ├── HostsPage.tsx       # Host management
│           ├── HostDetailPage.tsx  # Individual host detail
│           ├── ContainersPage.tsx  # Container listing
│           ├── ContainerDetailPage.tsx # Container detail (inspect/stats/logs)
│           ├── MonitoringPage.tsx  # Monitoring (placeholder)
│           ├── LogsPage.tsx        # Aggregated logs viewer
│           ├── AlertsPage.tsx      # Alerts (placeholder)
│           ├── IncidentsPage.tsx   # Incidents (placeholder)
│           ├── DeploymentsPage.tsx # Deployments (placeholder)
│           ├── MembersPage.tsx     # Organization members
│           ├── OrganizationsPage.tsx # Organization management
│           ├── SettingsPage.tsx    # Settings page
│           ├── BillingPage.tsx     # Billing (placeholder)
│           ├── AdminPage.tsx       # Admin panel
│           ├── HelpPage.tsx        # Help & support
│           └── SetupGuidePage.tsx  # Setup guide for new users
├── public/                         # Static assets
├── db-migrations/                  # Database migration files
├── dist/                           # Build output
├── index.html                      # HTML entry point
├── package.json                    # Dependencies & scripts
├── netlify.toml                    # Netlify config
├── vite.config.ts                  # Vite build config
├── vitest.config.ts                # Vitest test config
├── tailwind.config.ts              # Tailwind CSS config
├── eslint.config.js                # ESLint config
└── tsconfig*.json                  # TypeScript configs
```

## Key Locations

| Need to... | Look in |
|------------|---------|
| Add an API endpoint | `netlify/functions/api-*.mts` |
| Add a new app page | `src/pages/app/` + route in `src/App.tsx` |
| Add a marketing page | `src/pages/` + route in `src/App.tsx` |
| Add a UI component | `src/components/ui/` (shadcn) or `src/components/shared/` |
| Add a Docker feature | `src/services/docker-api.ts` + `src/hooks/useDocker.ts` |
| Change auth logic | `src/components/ProtectedRoute.tsx` + `netlify/functions/lib/auth.mts` |
| Modify DB schema | `netlify/schema.sql` + types in `src/types/database.ts` |
| Add environment vars | `.env` + `.env.example` |

## Naming Conventions

- Frontend pages: `PascalCase.tsx` (e.g., `DashboardPage.tsx`)
- Backend functions: `kebab-case.mts` prefixed with `api-` or `auth-` (e.g., `api-docker-proxy.mts`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useDocker.ts`)
- Components: `PascalCase.tsx`
- Types: `camelCase.ts` with PascalCase interfaces
- Backend libs: `camelCase.mts` (e.g., `auth.mts`, `crypto.mts`)

## Routing Structure

### Marketing (unauthenticated)
`/`, `/features`, `/pricing`, `/security`, `/docs`, `/contact`

### Auth
`/login/*`, `/signup` (→ redirect to login), `/beta-gate`, `/onboarding`

### App (protected, nested under `<AppShell>`)
`/app`, `/app/hosts`, `/app/hosts/:id`, `/app/containers`, `/app/containers/:id`, `/app/monitoring`, `/app/logs`, `/app/alerts`, `/app/incidents`, `/app/incidents/:id`, `/app/deployments`, `/app/members`, `/app/billing`, `/app/settings`, `/app/organizations`, `/app/admin`, `/app/help`, `/app/setup-guide`
