---
phase: 1
name: Dual-Mode Foundation and Local DX
created: 2026-03-02T00:00:00Z
mode: auto
---

# Phase 1 Context

## Vision

Ship a stable dual-mode foundation so the existing self-hosted Docker Dashboard keeps working while a local SaaS stack (cloud API, cloud web, data services, and agent) becomes one-command reproducible for development. Make transport expectations explicit so production paths are HTTPS/WSS only.

## What's Essential

Non-negotiable aspects:

- Existing self-hosted runtime remains functional and documented during cloud migration.
- Developers can start local cloud stack plus local agent through one documented command and complete seed setup.
- Production-facing cloud and agent paths enforce secure transport (HTTPS/WSS), not plaintext HTTP/WS.
- Documentation clearly distinguishes self-hosted mode versus SaaS mode, including when to use each.

## What's Flexible

Open to different implementations:

- Exact one-command developer entrypoint (`make`, `npm run`, or wrapper script) as long as docs and behavior are consistent.
- Which compose overlays and helper scripts are used to model local SaaS workflows.
- Specific transport enforcement mechanism (env validation, startup guardrails, reverse-proxy assumptions) as long as insecure production configs fail fast.

## What's Out of Scope

Explicitly NOT part of this phase:

- Multi-tenant identity, organizations/projects, and RBAC enforcement (Phase 2).
- Host enrollment token lifecycle and trusted connectivity model (Phase 3).
- Fleet inventory UX parity, telemetry pipelines, actions hardening, and alerting features (Phases 4-8).
- Broad architecture rewrites unrelated to dual-mode continuity and local DX bootstrapping.

## User Expectations

### Look and Feel
No required UI redesign in this phase. Existing self-hosted experience should remain unchanged. Any cloud UI work should be minimal and focused on startup sanity, not feature depth.

### Performance
Local dev startup should be reliable and predictable over raw speed. Clear health checks and deterministic service readiness are preferred over partial boot states.

### Integration
Phase 1 should fit the current repository layout (`apps/api`, `apps/web`, `packages/agent`, legacy `server/` and `public/`) without breaking existing users or local contributors.

## Examples / Inspiration

- Existing repository structure already contains both legacy self-hosted surfaces and cloud-oriented app folders.
- `docker-compose.example.yml` represents current self-hosted mode expectations.
- `docker-compose.base.yml` + `docker-compose.dev.yml` represent local SaaS stack direction.

## Questions Answered

Clarifications from /gsd-discuss-phase 1 --auto:

| Question | Answer |
|----------|--------|
| What is the primary objective of Phase 1? | Preserve self-hosted continuity while establishing reproducible local SaaS+agent workflows with secure transport defaults. |
| Which requirements are in-scope? | COMP-01, COMP-02, DEVX-01, DEVX-02, and SECU-02 only. |
| Should this phase introduce tenancy/auth? | No. Tenancy, auth, and RBAC begin in Phase 2. |
| What does "one command" mean for developers? | A single documented entrypoint that boots cloud API, cloud web, data services, and local agent, then supports seeded local setup. |
| How strict should transport security be now? | Production configuration must reject non-HTTPS/WSS URLs and fail fast on insecure values. |
| Should legacy mode be rewritten? | No. Keep existing self-hosted behavior first-class; add compatibility boundaries rather than rewrite in this phase. |

## Constraints

Technical or business constraints:

- Backward compatibility with existing self-hosted users is mandatory.
- Outbound-agent cloud direction must not require inbound customer-host ports.
- Local workflows should be Docker Compose centered for reproducibility.
- Security posture requires HTTPS/WSS-only production transport paths.
