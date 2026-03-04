---
phase: 6
name: Live Logs and Retention
created: 2026-03-04
status: ready
---

# Phase 6: Live Logs and Retention - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide live log tailing for selected containers with stream controls, downloadable logs for selected time ranges, and clear bounded-retention behavior. This phase covers log streaming UX and retention boundary handling only.

</domain>

<decisions>
## Implementation Decisions

### Live Tail Interaction Model
- **Follow mode:** Smart follow enabled by default (auto-follow only when user is near bottom)
- **When user scrolls up:** Keep ingesting live and show a sticky bottom-right `X new lines` jump hint
- **Jump behavior:** Smooth catch-up animation to latest lines
- **Reconnect behavior:** Silent auto-reconnect with subtle status badge
- **Reconnect gap behavior:** User-selectable toggle for `Backfill` vs `Now`
- **High-volume rendering:** Group lines by source blocks when possible
- **Long lines:** Wrap by default
- **Readability target:** Balanced defaults with optional compact mode
- **Preference persistence:** Persist follow mode, compact mode, and backfill/now per container
- **Spike handling:** Prompt user to switch to compact/high-throughput mode

### Stream Controls Behavior
- **Always-visible controls:** Pause/Resume, Follow toggle, Clear view, Compact/Readable mode toggle
- **Pause semantics:** Pause fetch + render until resume
- **Clear semantics:** UI-only clear (does not alter stream source), instant no confirm
- **Stream health indicator:** Minimal status (`Connected`, `Reconnecting`, `Paused`)
- **Controls placement:** Sticky top toolbar inside log panel; status badge on toolbar right side
- **Jump-to-latest control:** Contextual toolbar control shown only when not following (in addition to sticky jump hint)
- **Shortcuts:** Basic shortcuts enabled and scope-aware to focused log panel only; compact/readable mode has a single shortcut
- **Shortcut feedback:** No toast; rely on status/badge updates
- **Follow defaults:** Follow on by default when opening stream
- **Mode switching:** Compact/Readable switch is instant with no interruption
- **Global default behavior:** Global Backfill/Now defaults apply on next container open, with per-container override
- **Disconnected interactions:** Controls remain enabled for local state changes; pause toggle updates local state immediately even when disconnected
- **Clear while disconnected:** View stays empty until new lines arrive after reconnect
- **Pending count behavior:** Show `+N pending lines` while paused with capped display (`999+`); clear resets count to 0
- **Follow re-enable:** Immediate jump to latest
- **Pause after full reload:** Always unpaused on reload
- **Auto-follow during bursts:** Stay in follow mode unless user manually scrolls up
- **Metadata in compact mode:** Timestamp always shown
- **Control state after reconnect:** Safe reset (`Connected` + follow on + readable mode)

### Download Experience
- **Download scope:** Single-container logs only
- **Range selection:** Presets + start/end override
- **Preset set:** 15m, 1h, 6h, 24h
- **Formats:** Both plain `.log` and JSON export selectable
- **JSON shape:** NDJSON (one JSON object per line)
- **Delivery model:** Hybrid (direct browser download for small exports, background job for large)
- **Background UX:** Toast + downloads panel status flow
- **File naming:** `project/host/container` + UTC timestamps

### Retention Boundary UX
- **Partial out-of-range requests:** Auto-trim to available window and notify user
- **Fully out-of-range requests:** Clear empty state with retention explanation + quick in-range presets
- **Retention visibility:** Persistent retention hint near date picker
- **Export metadata:** Include requested range and delivered range when trimmed by retention

### Claude's Discretion
- Exact visual styling and wording tone for status badges, hints, and retention notices
- Exact animation timing for smooth catch-up and state transitions
- Exact downloads panel layout and iconography

</decisions>

<specifics>
## Specific Ideas

- Keep logs scan-friendly under high throughput while preserving operational clarity.
- Maintain predictable stream controls with visible status and minimal interruptions.
- Prefer contextual, non-blocking guidance over modal-heavy interruptions.

</specifics>

<deferred>
## Deferred Ideas

- Full-text log indexing/search tiers remain out of MVP scope.
- Alerting workflows remain in Phase 8.
- Container lifecycle actions remain in Phase 7.

</deferred>

---

*Phase: 06-live-logs-and-retention*
*Context gathered: 2026-03-04*
