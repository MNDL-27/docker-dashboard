# Code Conventions

## Code Style

### TypeScript
- **Strict mode**: Standard TypeScript strict config
- **Path aliases**: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Module system**: ESM throughout (`"type": "module"` in `package.json`)
- **Backend extension**: `.mts` for Netlify Functions (ESM TypeScript)
- **`@ts-expect-error`**: Used for Clerk global (`window.Clerk`) access patterns

### React
- **Functional components only**: No class components
- **Named exports** for components, `export default` for page-level components
- **Lazy loading**: All page components use `React.lazy()` with `Suspense` fallback
- **Props interfaces**: Explicit `interface Props` or inline destructured types
- **Hooks naming**: `use` prefix consistently (e.g., `useDocker`, `useHostMetrics`)

### CSS / Styling
- **TailwindCSS 3.4** with class-based dark mode (`darkMode: ["class"]`)
- **HSL CSS custom properties**: All colors defined as CSS vars in `index.css`, consumed via `hsl(var(--name))`
- **shadcn/ui**: Component library built on Radix primitives + Tailwind
- **`cn()` utility**: `clsx` + `tailwind-merge` for conditional class composition (`src/lib/utils.ts`)
- **Custom animations**: `fade-in`, `pulse-dot`, `accordion-down/up` defined in Tailwind config
- **Glass cards**: `.glass-card` utility class for frosted glass card effect

## Naming Patterns

### Files
| Context | Pattern | Example |
|---------|---------|---------|
| React pages | `PascalCase + Page` | `DashboardPage.tsx` |
| React components | `PascalCase` | `KPICard.tsx` |
| Hooks | `camelCase` with `use` prefix | `useDocker.ts` |
| Services | `kebab-case` with `-api` suffix | `docker-api.ts` |
| Backend functions | `api-` prefix, kebab-case | `api-docker-proxy.mts` |
| Backend lib | kebab-case | `host-url.mts` |
| Types | kebab-case | `database.ts` |
| Shared | kebab-case | `watchtower-agent-release.ts` |

### Variables & Functions
- **React components**: PascalCase (`StepHostBasics`, `CopyBlock`)
- **Functions**: camelCase (`apiFetch`, `buildValidatedAgentUrl`, `requireAuth`)
- **Constants**: UPPER_SNAKE_CASE (`CURRENT_WATCHTOWER_AGENT_RELEASE`, `CONNECTION_MODES`)
- **Types/Interfaces**: PascalCase (`DockerHost`, `AlertRule`, `AgentEnrollmentSession`)
- **Type aliases**: PascalCase (`ConnectionMode`, `AlertSeverity`)
- **Enums**: Not used — string literal union types preferred

### Database
- **Tables**: snake_case (`docker_hosts`, `alert_events`)
- **Columns**: snake_case (`host_url`, `connection_mode`, `last_seen_at`)
- **Timestamps**: `created_at`, `updated_at` with auto-update triggers
- **Foreign keys**: `{entity}_id` pattern (`organization_id`, `host_id`)

## Patterns

### API Layer Pattern
```typescript
// Service (src/services/docker-api.ts)
export const dockerApi = {
  action: (params) => apiFetch("/docker-proxy", { method: "POST", body: JSON.stringify(params) }),
};

// Hook (src/hooks/useDocker.ts)
export function useDocker() {
  const queryClient = useQueryClient();
  // React Query queries + mutations wrapping service calls
}
```

### Backend Function Pattern
```typescript
// netlify/functions/api-*.mts
export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  
  const auth = await requireAuth(req);
  // ... business logic ...
  return new Response(JSON.stringify(data), { headers });
};

export const config: Config = { path: "/api/endpoint-name" };
```

### Encryption Pattern
```typescript
// Encryption at rest for secrets
const encrypted = encryptSecret(plaintext, contextId, fieldName);
const decrypted = decryptSecret(ciphertext, contextId, fieldName);
// Uses AES-256-GCM with key rotation support (APP_ENCRYPTION_KEY_V1, V2, etc.)
```

### Schema Ensure Pattern
```typescript
// netlify/functions/lib/ensure-*.mts
// Idempotent schema migration — runs ALTER TABLE IF NOT EXISTS on each function call
// Ensures backward-compatible schema evolution without downtime
await ensureAgentEnrollmentSchema();
```

## Error Handling

### Frontend
- `ApiError` class with `status`, `body`, `rawText`, `code`, `upstreamStatus`
- Toast notifications for user-facing errors via `useToast()` and Sonner
- Try/catch in hooks with error state management

### Backend
- `createProblemResponse()` for RFC 7807 problem detail responses
- `badRequest()` helper for 400-class errors with optional error codes
- `SecretCryptoError` class for encryption failures
- Consistent `try/catch` with error code classification

## Import Conventions
- **Absolute imports**: `@/components/...`, `@/lib/...`, `@/hooks/...`
- **Relative imports**: Only within the same feature directory
- **Shared code**: `../../shared/...` from backend functions
- **lucide-react**: Individual icon imports (not barrel)
