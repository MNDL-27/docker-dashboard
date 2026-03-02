---
phase: 3
name: Host Enrollment and Trusted Connectivity
created: 2026-03-02T00:00:00Z
mode: auto
---

# Phase 3 Context

## Vision

Enable operators to securely enroll Docker hosts into the cloud control plane using a one-time bootstrap flow that exchanges into durable agent credentials. Once enrolled, host connectivity should be trustworthy and easy to understand through heartbeat-based online/offline status and last-seen visibility.

## What's Essential

Non-negotiable aspects:

- Operators can create host records and generate one-time enrollment tokens.
- Enrollment install snippets include the correct cloud URL and token so setup is copy/paste friendly.
- First-connect enrollment token exchange is validated, single-use, and results in durable agent credentials.
- Host online/offline state and last-seen timestamps are derived from heartbeat freshness and shown to users.
- Per-host rate limits protect API and ingest paths from abusive traffic without harming healthy hosts.

## What's Flexible

Open to different implementations:

- Exact token format and credential material (opaque tokens, signed credentials, key pairs) as long as security invariants hold.
- Enrollment UX details (modal, wizard, inline panel) as long as creation and copy flow are clear.
- Heartbeat interval and staleness thresholds as long as status behavior is deterministic and documented.
- Specific throttling algorithm and storage strategy as long as limits are enforced per host.

## What's Out of Scope

Explicitly NOT part of this phase:

- Fleet inventory drill-downs and advanced host/container filtering UX (Phase 4).
- Metrics history, live logs, and retention surfaces (Phases 5-6).
- Container action dispatch workflows, audit trails, and monitor-only controls (Phase 7).
- Alert rule authoring and notification delivery channels (Phase 8).

## User Expectations

### Look and Feel
Enrollment should feel explicit and trustworthy, with clear steps and copy-ready install instructions. Connectivity status should be easy to scan, with obvious online/offline state and recent heartbeat context.

### Performance
Token generation and first enrollment handshake should complete quickly in normal conditions. Status transitions should update predictably based on heartbeat freshness without long ambiguity windows.

### Integration
Phase 3 should build on Phase 2 tenant boundaries so enrollment and connectivity views remain organization/project scoped. Agent connectivity must preserve the outbound-only model and work cleanly with existing local SaaS workflows.

## Examples / Inspiration

- Phase 3 success criteria and dependency chain in `.planning/ROADMAP.md`.
- Enrollment and connectivity requirements (`ENRL-*`, `SECU-03`) in `.planning/REQUIREMENTS.md`.
- Outbound-only connectivity and enrollment credential constraints in `.planning/PROJECT.md` and `.planning/STATE.md` decisions.

## Questions Answered

Clarifications from /gsd-discuss-phase 3 --auto:

| Question | Answer |
|----------|--------|
| What is the primary objective of Phase 3? | Deliver secure host enrollment and trustworthy agent connectivity status so operators can onboard hosts and trust fleet presence. |
| Which requirements are in-scope? | ENRL-01 through ENRL-05 and SECU-03 only. |
| What security guarantee is required for enrollment tokens? | Tokens must be validated on first connect, rejected when invalid or reused, and exchanged for durable agent credentials. |
| What must users be able to see after enrollment? | Host online/offline status and last-seen timestamps derived from heartbeat freshness. |
| Should this phase include full fleet inventory or telemetry UX? | No. Inventory deep views and telemetry/log features remain in Phases 4-6. |
| How should abusive host traffic be handled? | Enforce per-host API and ingest rate limits so abusive clients are throttled while healthy hosts continue operating. |

## Constraints

Technical or business constraints:

- Outbound-only agent connectivity remains mandatory; no inbound customer-host ports are introduced.
- Enrollment bootstrap secrets must be short-lived and single-use enough to prevent replay enrollment.
- Durable agent credentials require protected storage, rotation strategy, and tenant-scoped binding.
- Connectivity state must remain tenant-scoped and consistent with Phase 2 authorization boundaries.
