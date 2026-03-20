# Conventions

## Code Style

### TypeScript
- **Strict mode:** Enabled via `tsconfig.app.json`
- **Path aliases:** `@/` maps to `./src/` (configured in both Vite and TypeScript)
- **Type assertions:** Preferred over `as` where possible, but `as` is common (e.g., `data as DockerHost[]`)
- **`@ts-expect-error`:** Used sparingly (e.g., `window.Clerk` global access in `api.ts`)
- **Unused vars:** ESLint rule disabled (`@typescript-eslint/no-unused-vars: "off"`)

### React Patterns
- **Functional components only** — No class components anywhere in codebase
- **Named exports** for components that have co-located logic (e.g., `ProtectedRoute`)
- **Default exports** for page components (e.g., `export default LandingPage`)
- **Hooks:** Custom hooks prefixed with `use`, co-located in `src/hooks/`
- **No context providers** — `src/contexts/` exists but is empty; state managed via React Query + component-local state

### Component Organization
```typescript
// Typical component structure:
import { ... } from "react";             // React imports
import { ... } from "@/components/ui/..."; // UI component imports
import { ... } from "@/hooks/...";        // Hook imports
import { ... } from "@/lib/...";          // Utility imports

export function ComponentName() {
  // hooks
  // derived state
  // handlers
  // return JSX
}
```

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Page component | PascalCase + `Page` suffix | `DashboardPage.tsx` |
| UI component | PascalCase | `MetricCard.tsx` |
| Hook | camelCase, `use` prefix | `useDocker.ts` |
| Service | kebab-case | `docker-api.ts` |
| Backend function | `api-` + kebab-case + `.mts` | `api-docker-proxy.mts` |
| Backend lib | camelCase + `.mts` | `auth.mts` |
| Type file | camelCase + `.ts` | `database.ts` |
| CSS variable | `--kebab-case` | `--primary-foreground` |

## Styling Patterns

- **TailwindCSS** with dark mode via `class` strategy
- **CSS custom properties** for theming (defined in `index.css`, consumed via `hsl(var(--...))`)
- **`cn()` utility** (`src/lib/utils.ts`) — `clsx` + `tailwind-merge` for conditional class merging
- **class-variance-authority (CVA)** for component variants (buttons, badges, etc.)
- **No inline styles** — All styling via Tailwind utilities
- **Dark-first:** App initializes in dark mode via `DarkModeInit` component

## Error Handling

### Frontend
- `apiFetch()` throws `Error` on non-OK responses with parsed error message
- React Query `onError` callbacks for mutation feedback
- Toast notifications (`sonner`) for user-facing error messages
- `ProtectedRoute` catches auth failures → redirect to `/login`

### Backend
- Functions return structured JSON errors: `{ error: string, details?: string }`
- HTTP status codes: 400 (bad request), 401/403 (auth), 404 (not found), 502 (proxy failure), 504 (timeout), 413 (payload too large)
- `requireAuth()` throws on auth failure → caught in function handler → JSON error response
- Crypto module: fails fast on startup if encryption key is misconfigured

## API Conventions

### Netlify Function Pattern
```typescript
import type { Config } from '@netlify/functions';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const auth = await requireAuth(req);
    // ... business logic ...
    return new Response(JSON.stringify(result), { headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: ... });
  }
};

export const config: Config = { path: '/api/endpoint-name' };
```

### Frontend Data Fetching Pattern
```typescript
// Hook wrapping TanStack Query
export function useDockerHosts(orgId?: string | null) {
  return useQuery({
    queryKey: ['docker-hosts', orgId],
    queryFn: async () => (await apiFetch(`/docker-hosts?orgId=${orgId}`)) as DockerHost[],
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}
```

## Git Conventions

- Standard `.gitignore` excluding `node_modules/`, `dist/`, `.env`
- No branch naming conventions observed (main branch)
- Build/error log files committed (likely unintentional: `build.log`, `error.log`, etc.)
