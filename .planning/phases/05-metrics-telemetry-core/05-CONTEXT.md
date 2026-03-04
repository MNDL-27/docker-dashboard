---
phase: 5
name: Metrics Telemetry Core
created: 2026-03-04
status: ready
---

# Phase 5: Metrics Telemetry Core - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver live container metrics visibility with bounded short-history windows (15m, 1h, 6h, 24h) and at least 24-hour retention. This phase focuses on telemetry visibility behavior, not logs, actions, or alerting workflows.

</domain>

<decisions>
## Implementation Decisions

### Live Metrics Surface
- **Entry point:** Fleet-level first
- **Update behavior:** Streaming updates
- **Primary live presentation:** KPI cards only (CPU, memory, network, restart indicators)
- **Selection behavior:** Auto-follow selected container/host from inventory context
- **Default live focus:** Top N active containers (most busy)
- **Live controls:** Full live controls (Pause/Resume + speed presets)
- **Visual emphasis:** Balanced (equal weight to current value and state)
- **Multi-container scope behavior:** Aggregate + top contributor list

### Claude's Discretion
- History window switching interaction details for 15m/1h/6h/24h were not discussed yet.
- Missing-data/stale-data state wording and visuals were not discussed yet.
- Final card density/compactness for telemetry-specific UI was not discussed yet.

</decisions>

<specifics>
## Specific Ideas

- Keep the telemetry surface scan-friendly and operationally focused.
- Live metrics should stay centered on KPI cards rather than chart-first layouts.

</specifics>

<deferred>
## Deferred Ideas

- Logs UX and retention controls are Phase 6.
- Container lifecycle actions are Phase 7.
- Alerting and notification workflows are Phase 8.

</deferred>

---

*Phase: 05-metrics-telemetry-core*
*Context gathered: 2026-03-04*
