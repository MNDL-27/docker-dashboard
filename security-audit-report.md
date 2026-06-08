# Security Audit Report: FRE-154

**Date:** 2026-06-08
**Scope:** Full codebase scan for threats and vulnerabilities
**Branch:** paperclip-monorepo

---

## Executive Summary

The Docker Watchtower Dash codebase demonstrates a strong security posture. The audit covered 35+ source files across the backend (Netlify Functions) and frontend (React). Key findings: 0 critical vulnerabilities in application code, 1 previously reported command injection vector resolved, and 29 type-safety violations fixed.

---

## 1. Findings & Remediations

### 1.1 Resolved: Command Injection Vector (Critical)

**File:** `apps/backend/netlify/functions/lib/proxy/actions/filesystem.ts` (previously in monolithic `api-docker-proxy.mts`)

**Before:** `container-fs-list` used `sh -c` to execute `ls` with stringified arguments, creating a potential command injection vector if the container shell was non-standard.

**After:** Both `container-fs-list` and `container-fs-read` now use the Docker API `/containers/{id}/archive` endpoint directly. All paths are validated with absolute path checks and `..` traversal rejection. Container IDs are sanitized via regex (`/^[a-f0-9]{12,64}$/i`).

### 1.2 Resolved: 29 Type Safety Violations (High)

**Files:** All proxy modules (`router.ts`, `client.ts`, `container-cache.ts`, `metrics.ts`, `utils.ts`, `actions/*.ts`)

All `@typescript-eslint/no-explicit-any` violations in the new proxy decomposition were fixed:
- `catch(err: any)` → `catch(err: unknown)` with `instanceof Error` narrowing
- `Record<string, any>` → `Record<string, unknown>`
- `any[]` → `Record<string, unknown>[]`
- `action as any` → proper union type `'container-start' | 'container-stop' | 'container-restart'`

### 1.3 Retained: Secrets Management (Verified)

**File:** `apps/backend/netlify/functions/lib/crypto.mjs`

Uses `aes-256-gcm` with AAD (Additional Authenticated Data) including `hostId` and `fieldName`. Prevents secret reuse and misplacement. Supports key rotation. No issues found.

### 1.4 Retained: Authentication & Tenant Isolation (Verified)

**File:** `apps/backend/netlify/functions/lib/auth.mjs`, `apps/backend/netlify/functions/lib/access-controls.mjs`

Clerk-based session auth with organization-level membership checks. All proxy operations verify user has access to the target host's organization before proceeding. Node limit enforcement gates host access based on plan entitlements. No issues found.

### 1.5 Retained: Rate Limiting (Verified)

**File:** `apps/backend/netlify/functions/lib/security.mjs`

Database-backed rate limiting with per-organization tracking. Prevents per-instance bypass in serverless environment. Separate rate limit tiers for proxy operations vs. general API. No issues found.

### 1.6 Retained: Container ID Sanitization (Verified)

**File:** `apps/backend/netlify/functions/lib/proxy/utils.ts`

`sanitizeContainerId()` uses a strict regex `/^[a-f0-9]{12,64}$/i` to reject malformed container IDs, preventing injection through ID parameters. No issues found.

### 1.7 Retained: Payload Size Limits (Verified)

**File:** `apps/backend/netlify/functions/lib/proxy/client.ts`

Streaming response reader enforces configurable `maxPayloadSize` (default 4MB). Returns HTTP 413 when exceeded. Prevents memory exhaustion from oversized agent responses. No issues found.

### 1.8 Added: Audit Logging

**File:** `apps/backend/netlify/functions/lib/proxy/audit.ts`

All sensitive operations (file reads, container mutations, log access) are now logged to `proxy_audit_log` table with actor ID, organization, action, host, and metadata. Supports post-incident investigation and compliance.

---

## 2. Dependency Vulnerabilities (npm audit)

| Severity | Package | Count | Impact |
|----------|---------|-------|--------|
| High | fast-uri, fastify, multiparty | 3 transitive via netlify-cli | Dev dependency only |
| Moderate | esbuild, postcss, qs, brace-expansion, @fastify/static | 5 transitive via netlify-cli/vite | Dev dependency only |

All high-severity findings are transitive dependencies of `netlify-cli` (dev dependency). No production dependency vulnerabilities found.

**Mitigation:** Dependabot is already configured with weekly automated security updates.

---

## 3. Remaining Recommendations

1. **TypeScript strict mode**: Consider enabling `strict: true` in `tsconfig.json` to catch implicit `any` at compile time rather than via lint rules.
2. **Input validation framework**: Standardize on Zod (already in use partially) for all runtime input validation across the entire backend.
3. **Secrets rotation policy**: Document a key rotation procedure for the AES-256-GCM encryption key used by `crypto.mjs`.
4. **Container image scanning**: Add a CI step to scan production Docker images for known CVEs before deployment.

---

## 4. Verification

| Check | Status |
|-------|--------|
| Lint (0 errors) | ✅ |
| TypeScript (noEmit) | ✅ |
| Tests (18/18 pass) | ✅ |
| npm audit (no production vulns) | ✅ |

---

*Audit performed by Release Engineer (agent 9aa58f75)*
