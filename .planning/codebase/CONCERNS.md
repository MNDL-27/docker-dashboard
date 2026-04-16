# Concerns & Technical Debt

## 🔴 Critical UX Issues

### Cloudflare Tunnel Users Don't Know Which Port to Point Their Domain At

**Severity**: High — blocks onboarding for CF Tunnel users
**Location**: Onboarding flow + SetupGuidePage + Agent docs

When a user selects "Agent via CF Tunnel" as their connection mode, the onboarding flow does **not tell them which port** to configure in their Cloudflare Tunnel's public hostname routing. The Watchtower Agent listens on **port 9876** by default, and the tunnel must forward traffic to `http://127.0.0.1:9876` — but this is never surfaced in the UI.

**Evidence:**
- `src/pages/onboarding/StepHostBasics.tsx` line 77: Placeholder says `https://docker.your-team.cloudflareaccess.com` — no mention of port 9876
- `src/pages/onboarding/StepHostCredentials.tsx`: Shows install command and verify command but never mentions the port the tunnel should forward to
- `src/pages/app/SetupGuidePage.tsx` line 254-256: Shows `cloudflared tunnel run --url http://127.0.0.1:9876` — this is the ONLY place port 9876 appears, but it's on the post-onboarding setup guide, not during onboarding
- `shared/watchtower-agent-release.ts` line 156: `getWatchtowerAgentRecommendedBindAddress()` returns `127.0.0.1` for CF Tunnel but doesn't surface port
- `netlify/functions/api-agent-enrollments.mts` line 361: Exchange endpoint returns `port: "9876"` but it's only sent to the agent install script, never shown in the UI

**What needs fixing:**
1. **Onboarding StepHostCredentials**: When `connectionMode === "cloudflare_tunnel"`, add a visible info block: "Point your Cloudflare Tunnel's public hostname to `http://127.0.0.1:9876`"
2. **Onboarding StepHostBasics**: Update the helper info card to mention port 9876 for CF Tunnel mode
3. **SetupGuidePage**: Already has this info in Step 3 of the CF Tunnel tab, but could be more prominent
4. **Consider adding a dedicated "Configure your tunnel" step** in the CF Tunnel onboarding flow

---

## 🟡 Code Health

### Large File Sizes

Several files have grown beyond maintainable sizes:

| File | Lines | Concern |
|------|-------|---------|
| `src/pages/DocsPage.tsx` | 1011 | Inline docs content — should be externalized |
| `netlify/functions/api-docker-proxy.mts` | 753 | Monolithic function handling 15+ actions |
| `netlify/functions/api-agent-enrollments.mts` | 595 | Complex enrollment flow in single file |
| `src/components/hosts/HostWorkspace.tsx` | ~52KB | Massive host detail component |
| `src/pages/app/AdminPage.tsx` | ~41KB | Platform admin with many inline sub-components |
| `src/pages/app/ContainersPage.tsx` | ~23KB | Container list with inline filtering logic |
| `src/pages/app/ContainerDetailPage.tsx` | ~20KB | Container detail with 4 tab panels inline |
| `src/pages/onboarding/useOnboardingState.ts` | 398 | Complex state machine (recently refactored from 692-line monolith) |

### Cyclomatic Complexity
- `OnboardingPage.tsx` was recently refactored (conversation history shows it had CC=116)
- `api-docker-proxy.mts` action switch with 15+ branches is a candidate for splitting

## 🟡 Security Concerns

### Agent API Key in Manual Install Command
- The "advanced manual install" command in `StepHostCredentials.tsx` embeds the raw agent API key
- It's masked by default with reveal toggle, but the key is in the browser DOM
- The enrollment-token flow is the recommended path (key never leaves server until agent claims it)

### CORS Wildcard
- Backend functions use `Access-Control-Allow-Origin: *` (see `api-docker-proxy.mts` line 14)
- Auth is JWT-based so this is safe, but it's worth documenting the rationale

### Platform Admin Email Allowlist
- `PLATFORM_ADMIN_EMAILS` env var controls god-mode access
- No MFA enforcement documented for admin access

## 🟡 Missing Features / Incomplete Areas

### Empty Contexts Directory
- `src/contexts/` is empty — state is managed through hooks + React Query
- This is fine architecturally but the empty directory is noise

### No Test Framework
- No test runner configured despite `CLAUDE.md` referencing `npm test`
- Only 2 tiny test files exist (see TESTING.md)
- Security-critical code (crypto, URL validation, auth) has zero test coverage

### Redirect Pages
- Several pages are just redirects, suggesting incomplete feature work:
  - `MonitoringPage.tsx` → redirects to `/app/alerts`
  - `IncidentsPage.tsx` → redirects to `/app/alerts`
  - `DeploymentsPage.tsx` → redirects to `/app/hosts`

### Build Artifacts in Repo
- `build-final.log`, `build.log`, `build2.log`, `build3.log`, `dev.log`, `error.log` — should be gitignored
- `netlify-live.err`, `netlify-live.out` — deployment output files in repo
- `bun.lock` and `bun.lockb` alongside `package-lock.json` — dual lockfile confusion

## 🟡 Performance Concerns

### Serial Container Stats
- `api-docker-proxy.mts` `all-container-stats` action queries all hosts sequentially (bounded at 5 concurrent)
- Each host caps at 20 containers, each with a 3-second timeout
- Worst case: 5 hosts × 20 containers × 3s = potentially very slow

### Large Inline Documentation
- `DocsPage.tsx` at 58KB is entirely inline React JSX — no markdown processing
- Changes to documentation require React component edits

### No Frontend Caching Strategy
- `useHostMetrics.ts` polls every interval but doesn't cache across navigation
- React Query default caching helps, but no explicit staleTime configuration visible

## 🟢 Positive Patterns

### Good Security Practices
- AES-256-GCM encryption at rest for all secrets with key rotation support
- Agent API keys never returned to browser after initial enrollment
- URL validation blocks SSRF (private IPs, loopback, link-local)
- Idempotency keys required for mutations
- SHA-256 checksum verification for agent installer downloads

### Good Architecture Decisions
- Agent-proxy pattern keeps Docker sockets off the internet
- Enrollment-token flow avoids embedding long-lived secrets in install commands
- Server-side health polling with alert rules for proactive monitoring
- Multi-tenant org-based isolation with role-based access
