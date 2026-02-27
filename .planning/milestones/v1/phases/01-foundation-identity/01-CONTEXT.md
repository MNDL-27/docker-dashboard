# Phase 1: Foundation & Identity - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can authenticate, create organizations/projects, and run the full local development stack. This includes signup/login with session management, multi-tenant org/project structure with RBAC roles, and a local development environment with docker-compose.

</domain>

<decisions>
## Implementation Decisions

### Session Handling
- HTTP-only session cookies (not JWT in localStorage)
- Auto-refresh tokens when access token expires
- Sessions persist for 7 days
- Logout only invalidates current device (not all sessions)

### RBAC Model
- Two-level: Org roles + Project roles (like GitHub org/repo)
- Project roles inherit from org roles by default
- Viewer role is read-only (no actions)
- Single owner for free tier, multiple owners for paid tier

### Onboarding Flow
- Free users: No org required, can add single host directly
- Paid users: Optional org (can choose org or single host)
- New signup: Creates account, then guided to create org (paid) or add host (free)
- First-time experience: Onboarding checklist with guided tour/tooltips

### Dev Environment
- Structure: Base docker-compose + override files
- Base includes: PostgreSQL, Redis, LocalStack (S3)
- No seeded test user - users create their own account
- Setup script generates .env files

### Claude's Discretion
- Exact cookie security settings (Secure flag, SameSite)
- Database schema for sessions and tokens
- LocalStack configuration vs real S3
- Onboarding checklist UI/UX details

</decisions>

<specifics>
## Specific Ideas

- "free user have no org paid user can only have org" → Free users get single-host mode, paid users can choose org or single-host
- "Single host for free tier" → Free tier limited to 1 Docker host
- "Optional org" for paid → Paying users can skip org structure if they only have 1-2 hosts

</specifics>

<deferred>
## Deferred Ideas

- Billing integration (Phase 5+)
- Multiple owner support for paid tier (Phase 5+)
- Team invitations workflow details

</deferred>

---

*Phase: 01-foundation-identity*
*Context gathered: 2026-02-27*
