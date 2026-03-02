---
phase: 2
name: Identity, Access, and Tenant Isolation
created: 2026-03-02T00:00:00Z
mode: auto
---

# Phase 2 Context

## Vision

Establish a secure multi-tenant identity foundation so users can sign up, authenticate, collaborate in organizations/projects, and operate with strict access boundaries. Every user action and data read must be scoped to memberships and roles, with cross-tenant leakage prevented by default.

## What's Essential

Non-negotiable aspects:

- Users can create accounts, log in, remain authenticated across sessions, and log out cleanly.
- Organizations and projects are first-class scopes, and users only see scopes they belong to.
- Owner/Admin/Operator/Viewer roles are enforced consistently in API and UI behavior.
- Tenant isolation is enforced fail-closed across all data access paths so out-of-scope records are never returned.

## What's Flexible

Open to different implementations:

- Auth/session implementation details (cookie session vs token-based flow) if security and UX requirements are met.
- Authorization architecture (central policy engine or consolidated middleware/service layer) if role checks stay consistent.
- Invitation UX mechanics (email invite, link-based invite, or local-dev-friendly manual onboarding) if membership boundaries remain strict.

## What's Out of Scope

Explicitly NOT part of this phase:

- Host enrollment token lifecycle, durable agent credentials, and heartbeat trust model (Phase 3).
- Fleet inventory parity, telemetry ingestion/retention, logs UX, and actions/alerts features (Phases 4-8).
- Enterprise identity extensions like SSO/SAML/SCIM/MFA beyond MVP email/password requirements.

## User Expectations

### Look and Feel
Authentication and membership flows should feel clear and low-friction, with obvious organization/project context. No broad visual redesign is required; prioritize clarity of access boundaries over new styling.

### Performance
Login, session restore, organization/project switching, and role-gated navigation should feel responsive in normal local and hosted conditions. Access-denied paths should fail quickly and predictably.

### Integration
Phase 2 should integrate cleanly with existing repository surfaces (`apps/api`, `apps/web`, Prisma schema/state, and local SaaS workflows from Phase 1) without regressing self-hosted compatibility expectations.

## Examples / Inspiration

- Roadmap success criteria for Phase 2 in `.planning/ROADMAP.md`.
- Identity and tenancy requirements (`TEN-*`, `AUTH-*`, `SECU-01`) in `.planning/REQUIREMENTS.md`.
- Existing role baseline decision in `.planning/STATE.md` (Owner/Admin/Operator/Viewer).

## Questions Answered

Clarifications from /gsd-discuss-phase 2 --auto:

| Question | Answer |
|----------|--------|
| What is the primary objective of Phase 2? | Deliver secure authentication, organization/project membership, role-based access, and strict tenant isolation as the platform's trust boundary baseline. |
| Which requirements are in-scope? | TEN-01 through TEN-05, AUTH-01 through AUTH-04, and SECU-01 only. |
| Which roles must be supported now? | Owner, Admin, Operator, and Viewer are the MVP role set. |
| What must tenant isolation guarantee? | Users can only read/write data in organizations/projects where they have membership; cross-tenant access attempts are denied by default. |
| Should this phase include enrollment/agent trust work? | No. Enrollment and trusted host connectivity remain in Phase 3. |
| Is broad UI redesign expected in this phase? | No. Prioritize access clarity and correctness over visual overhaul. |

## Constraints

Technical or business constraints:

- Security posture requires tenant-scoped enforcement across API, data layer, and derived access paths.
- Role checks must be deterministic and auditable enough to prevent privilege drift between endpoints/features.
- Phase 1 local SaaS developer workflows must remain operable while adding auth and tenancy primitives.
- No feature work that dilutes focus from identity, membership, and isolation invariants.
