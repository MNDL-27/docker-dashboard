---
phase: 05-metrics-telemetry-core
plan: 03
subsystem: ui
tags: [telemetry, websocket, nextjs, fleet, kpi]

# Dependency graph
requires:
  - phase: 05-metrics-telemetry-core
    provides: tenant-safe telemetry history/live contracts and stream controls
provides:
  - Fleet-level KPI telemetry panel with live stream controls and history presets
  - Typed web telemetry API/websocket contracts for history, snapshots, and control messaging
  - Inventory-context auto-follow wiring from expanded host/container to telemetry scope
affects: [phase-06-logs-retention, phase-07-container-actions, phase-08-alerting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Typed websocket message parsing and builder helpers in shared web API client
    - KPI-first telemetry UI with explicit freshness state badges (Live/Paused/Stale/No data)
    - Fleet inventory selection as telemetry scope source-of-truth

key-files:
  created:
    - apps/web/src/components/telemetry/TelemetryControls.tsx
    - apps/web/src/components/telemetry/TelemetryKpiPanel.tsx
    - apps/web/src/components/telemetry/TopContributorsList.tsx
  modified:
    - apps/web/src/lib/api.ts
    - apps/web/src/components/fleet/FleetInventoryView.tsx
    - apps/web/src/components/fleet/ContainerCardGrid.tsx

key-decisions:
  - "Use Top N default of 5 in web telemetry query/subscribe contracts and let server ack override it."
  - "Keep telemetry panel mounted at fleet entry and scope it by expanded host plus optional selected container."
  - "Treat live pause/speed as websocket controls while history window switching continues to refresh trend context."

patterns-established:
  - "Telemetry controls pattern: window chips + pause/resume + speed presets with server ack reconciliation"
  - "State-balanced KPI cards: value and freshness badge are rendered together on each metric card"

requirements-completed: [METR-01, METR-02]

# Metrics
duration: 13 min
completed: 2026-03-04
---

# Phase 5 Plan 3: Fleet Telemetry UX Summary

**Fleet now ships a KPI-first telemetry experience with live websocket controls, history windows, and inventory-scope auto-follow for host/container context.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-04T17:38:32Z
- **Completed:** 2026-03-04T17:52:28Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended `apps/web/src/lib/api.ts` with typed telemetry contracts for history/snapshot queries, websocket subscribe/control builders, and inbound frame parsing.
- Created telemetry UI primitives (`TelemetryControls`, `TelemetryKpiPanel`, `TopContributorsList`) implementing KPI-only cards for CPU/memory/network/restarts with explicit freshness state labels.
- Embedded telemetry into fleet inventory and wired auto-follow behavior so expanded host and selected container context drive telemetry scope while preserving existing host drill-down behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add telemetry client contracts for history windows, streaming frames, and live controls** - `50c96e3` (feat)
2. **Task 2: Build KPI-first telemetry components with balanced value/state emphasis** - `d2c72f3` (feat)
3. **Task 3: Integrate telemetry panel into fleet inventory with auto-follow scope** - `1efc796` (feat)

**Plan metadata:** pending (created after state/roadmap updates)

## Files Created/Modified
- `apps/web/src/lib/api.ts` - telemetry query/window/speed/topN contracts, websocket message builders/parsers, and typed history/live fetch helpers.
- `apps/web/src/components/telemetry/TelemetryControls.tsx` - pause/resume button, speed presets, and history window chips.
- `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx` - KPI card panel, websocket/live snapshot integration, stale/no-data state handling, and contributor rendering.
- `apps/web/src/components/telemetry/TopContributorsList.tsx` - Top N contributor ranking with optional selection handoff.
- `apps/web/src/components/fleet/FleetInventoryView.tsx` - fleet-level telemetry panel placement plus host/container scope wiring.
- `apps/web/src/components/fleet/ContainerCardGrid.tsx` - selectable container cards for telemetry focus selection.

## Decisions Made
- Used `topN=5` as the deterministic client default and preserved server authority through subscribe ack updates.
- Kept telemetry controls scoped to websocket fan-out behavior (pause/resume/speed) while history window switches continue fetching trend context.
- Added container card selection in inventory rather than introducing a separate telemetry-only selector, keeping scope controls tied to existing fleet interactions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build verification blocked by production transport guard**
- **Found during:** Task 1 verification
- **Issue:** `npm --prefix apps/web run build` failed because `NEXT_PUBLIC_API_URL` defaulted to `http://` while production build enforces `https://`.
- **Fix:** Re-ran build/lint verification commands with `NEXT_PUBLIC_API_URL="https://localhost:3001"` for plan execution checks.
- **Files modified:** None
- **Verification:** Web lint/build commands passed for Tasks 1-3 with the override.
- **Committed in:** N/A (verification environment adjustment only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Verification gate unblocked without changing runtime code scope; no feature scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fleet telemetry UX requirements for METR-01/METR-02 are implemented and validated by web lint/build.
- Phase 6 can build on established telemetry contracts/components without revisiting live control or history-window fundamentals.

---
*Phase: 05-metrics-telemetry-core*
*Completed: 2026-03-04*

## Self-Check: PASSED
