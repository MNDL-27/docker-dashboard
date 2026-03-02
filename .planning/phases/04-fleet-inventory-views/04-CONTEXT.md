---
phase: 4
name: Fleet Inventory Views
created: 2026-03-03
status: ready
---

# Phase 4: Fleet Inventory Views - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Display fleet composition (hosts and containers) with practical filtering and search. Users can view fleet-level counts, drill into hosts to see containers, and filter/search to find workloads quickly. This phase covers visibility only — metrics, logs, and actions are separate phases.
</domain>

<decisions>
## Implementation Decisions

### Layout Style
- **Navigation:** Drill-down — Fleet overview page, click host to expand container grid below
- **Hosts:** Cards with name, status (online/offline), container count, last seen timestamp, IP address, agent version, CPU/memory summary
- **Containers:** Card grid showing key info at a glance
- **Expand behavior:** Click host card to expand container grid below that host

### Information Density
- **Host cards:** Detailed — name, status, container count, last seen, IP, agent version, CPU/memory
- **Container cards:** Detailed — name, status, image, restarts, created time, labels, ports, networks, volumes
- **Expanded view:** Full detail — everything, like clicking into a detail view
- **Status indicators:** Detailed — color + text + error message when applicable
- **User setting:** In settings, user can toggle density between Simple / Standard / Detailed (default: Detailed)

### Filtering and Search
- **Search:** Full search across container names, images, and labels
- **Filters:** Multi-select for status (Running, Stopped, Restarting), project, and host
- **Apply:** Apply button to commit filter changes
- **UI:** Contextual — filters appear when user clicks "Filter" button

### Empty States
- **No hosts:** Quick start with brief instructions on how to enroll a host
- **No containers:** Info message + button to open host's Docker directly
- **No search results:** Clear message "No containers match your search"
- **Educational:** Guided step-by-step mini tutorials for common cases

</decisions>

<specifics>
## Specific Ideas

- Host cards feel like "issue cards in Linear" — clean, not cluttered
- Expand animation should be smooth, not jarring
- Status colors: Green (running), Red (stopped), Yellow (restarting), Gray (unknown)
- User density preference persists across sessions

</specifics>

<deferred>
## Deferred Ideas

- Container detail page (full view with all metadata) — Phase 7 or later
- Metrics on container cards — Phase 5 (Metrics Telemetry Core)
- Live log tail from container cards — Phase 6 (Live Logs)
- Container actions (start/stop/restart) from cards — Phase 7 (Safe Container Actions)

</deferred>

---

*Phase: 04-fleet-inventory-views*
*Context gathered: 2026-03-03*
