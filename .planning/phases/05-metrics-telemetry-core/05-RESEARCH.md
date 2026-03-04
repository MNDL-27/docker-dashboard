# Phase 5: Metrics Telemetry Core - Research

**Researched:** 2026-03-04  
**Domain:** Live container telemetry ingest, streaming fan-out, short-window history queries, and 24h retention  
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- Logs UX and retention controls are Phase 6.
- Container lifecycle actions are Phase 7.
- Alerting and notification workflows are Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| METR-01 | User can view live container metrics updates (CPU, memory, network, restart indicators). | Use existing `ws` stream path (`/ws/agent` -> `/ws/client`) with tenant-scoped telemetry subscription routing and KPI-card payloads (aggregate + top contributors). |
| METR-02 | User can view recent metrics history windows (15m, 1h, 6h, 24h). | Add metrics history query endpoints backed by `containerMetric.timestamp` + bucketed SQL (`date_bin`/`date_trunc`) and window presets; render trends as KPI-card sparklines/mini-trends (not chart-first pages). |
| METR-03 | Platform can retain metrics samples for at least 24 hours in MVP. | Keep 24h retention sweeper and harden it with deterministic cutoff/index-aware deletes + verification tests that data >24h is not queryable while <=24h remains queryable. |
</phase_requirements>

## Summary

Phase 5 should be implemented as a telemetry-focused extension of the existing fleet architecture, not a new observability subsystem. The repository already has key pieces: WebSocket transport (`apps/api/src/websocket/server.ts`), metric persistence (`apps/api/src/services/metrics.ts`), metrics schema (`prisma/schema.prisma`), and a fleet-first inventory surface (`apps/web/src/components/fleet/FleetInventoryView.tsx`).

The highest-risk gap is data-contract correctness, not UI rendering. Agent metrics currently emit `containerId` as Docker ID (`packages/agent/docker/client.go`), but `ContainerMetric.containerId` is a relation to internal DB container UUID (`prisma/schema.prisma`). Without an explicit Docker ID -> internal ID mapping at ingest, persistence/query behavior is unreliable. Fixing this mapping is prerequisite to all METR requirements.

The locked UX decisions imply a KPI-card-first telemetry surface with streaming updates, pause/resume + speed controls, Top N defaults, and aggregate + contributors for multi-container scope. History windows (15m/1h/6h/24h) should be implemented as window presets with server-side bucketed queries and compact trends inside cards (sparkline/trendline), avoiding chart-first layouts.

**Primary recommendation:** Build Phase 5 in this order: (1) ingest identity fix + retention hardening, (2) history query contract with bucketing, (3) fleet-level KPI-card streaming UX with controls and stale-data states.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ws` | `^8.19.0` (api) | Agent -> API and API -> web live metric streaming | Already in production path and aligned with `noServer` upgrade model from official ws docs. |
| Prisma Client | `^7.4.1` | Metric writes and history reads (`containerMetric`) | Existing data layer; supports batched writes, indexed reads, and raw SQL escape hatch where needed. |
| PostgreSQL | current | Time-window filtering and bucketing (`date_trunc`, `date_bin`) | Native time-series-style bucketing functions make 15m/1h/6h/24h trend windows straightforward and queryable. |
| Next.js + React | `next@^15.3.0`, `react@^19.0.0` | Fleet telemetry KPI-card UI | Existing dashboard route model and client state patterns are already in this stack. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | `^5.64.0` | Controlled polling fallback + cache synchronization for history windows | Use for history fetch and reconciliation while live stream runs independently. |
| Zod | `^3.24.0` | Validate telemetry query/window params and websocket message payloads | Use at all ingress boundaries (`window`, `scope`, `topN`, control payloads). |
| `date-fns` | `^4.1.0` | Consistent timestamp formatting in KPI cards | Use for compact window labels and last-update freshness formatting. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebSocket streaming | SSE | Simpler one-way stream, but existing stack already supports bidirectional controls (pause/speed intent) and agent ingest over ws. |
| Prisma-only aggregation | Prisma + SQL bucket query (`$queryRaw`) | Prisma groupBy cannot bucket transformed timestamps directly; SQL bucketing is clearer and more performant for window trends. |

**Installation:**
```bash
npm --prefix apps/api install
npm --prefix apps/web install
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/api/src/
├── routes/metrics.ts             # metrics history + live KPI query contract
├── services/metrics.ts           # ingest mapping, retention, and bucketing helpers
├── websocket/server.ts           # live metric relay with scope-aware subscriptions
└── services/scopedAccess.ts      # tenant/project scope enforcement reuse

apps/web/src/
├── components/telemetry/TelemetryKpiPanel.tsx      # fleet-level KPI card grid
├── components/telemetry/TelemetryControls.tsx      # pause/resume + speed presets + window chips
├── components/telemetry/TopContributorsList.tsx    # top N active containers
└── lib/api.ts                                       # telemetry history/live API methods
```

### Pattern 1: Resolve Container Identity at Ingest
**What:** Convert inbound Docker container IDs to internal `container.id` before inserting metric rows.
**When to use:** Every metric write path from agent websocket payload.
**Example:**
```typescript
// Source: repo schema + ingest code mismatch (prisma/schema.prisma, apps/api/src/services/metrics.ts, packages/agent/docker/client.go)
const containers = await prisma.container.findMany({
  where: { hostId, dockerId: { in: metricsArray.map((m) => m.containerId) } },
  select: { id: true, dockerId: true },
});

const byDockerId = new Map(containers.map((c) => [c.dockerId, c.id]));
const rows = metricsArray
  .map((m) => ({ ...m, containerId: byDockerId.get(m.containerId) }))
  .filter((m): m is typeof m & { containerId: string } => Boolean(m.containerId));

await prisma.containerMetric.createMany({
  data: rows.map((m) => ({
    containerId: m.containerId,
    cpuUsagePercent: m.cpuUsagePercent,
    memoryUsageBytes: BigInt(m.memoryUsageBytes),
    networkRxBytes: BigInt(m.networkRxBytes),
    networkTxBytes: BigInt(m.networkTxBytes),
  })),
});
```

### Pattern 2: Window-Preset Query with Server-Side Bucketing
**What:** Query by explicit window (`15m|1h|6h|24h`) and return bucketed trends sized for cards.
**When to use:** METR-02 history windows and KPI sparkline trend loads.
**Example:**
```typescript
// Source: PostgreSQL date_bin/date_trunc docs + Prisma raw query docs
const rows = await prisma.$queryRaw<Array<{
  bucket: Date;
  cpu_avg: number;
  mem_avg: bigint;
  rx_last: bigint;
  tx_last: bigint;
}>>`
  SELECT
    date_bin(${bucketSize}::interval, "timestamp", ${origin}::timestamptz) AS bucket,
    avg("cpuUsagePercent") AS cpu_avg,
    avg("memoryUsageBytes")::bigint AS mem_avg,
    max("networkRxBytes") AS rx_last,
    max("networkTxBytes") AS tx_last
  FROM "ContainerMetric"
  WHERE "containerId" = ${containerId}
    AND "timestamp" >= ${windowStart}
  GROUP BY bucket
  ORDER BY bucket ASC
`;
```

### Pattern 3: KPI-First Stream Model with Controls
**What:** Keep live display in KPI cards, and treat trends as secondary card context.
**When to use:** All live telemetry rendering in this phase.
**Example:**
```tsx
// Source: locked decisions (KPI-first, pause/resume, speed presets)
const [liveMode, setLiveMode] = useState<'running' | 'paused'>('running');
const [speed, setSpeed] = useState<1 | 2 | 4>(1);

function onMetricFrame(frame: TelemetryFrame) {
  if (liveMode === 'paused') return;
  updateKpiCards(frame.aggregate, frame.topContributors, speed);
}
```

### Anti-Patterns to Avoid
- **Chart-first telemetry layout:** violates locked KPI-first presentation and slows operator scan.
- **Client-only window aggregation:** causes inconsistent numbers and higher browser CPU on larger fleets.
- **Unscoped websocket fan-out:** risks cross-tenant leakage if frames are broadcast without scope checks.
- **Single-state control model for live/history:** mixing stream status and history window state causes UI races.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time bucketing logic in JS loops | custom ad-hoc interval reducers | PostgreSQL `date_bin`/`date_trunc` via safe `$queryRaw` | Database-native bucketing is more correct for time boundaries and scales better. |
| WebSocket heartbeat and broken-link detection | custom ping protocol | `ws` built-in ping/pong patterns | Official `ws` guidance already covers dead-connection handling. |
| Full custom cache invalidation bus | homegrown client event graph | TanStack Query + targeted invalidation/refetch | Reduces stale-state bugs when switching windows/scopes. |
| Label-heavy metric schema expansion | arbitrary tag dimensions per sample | fixed MVP metric columns + bounded metadata | Prevents cardinality and retention cost blowups in MVP. |

**Key insight:** In this phase, custom code should focus on tenant-scoped telemetry contracts and KPI semantics, not reinventing stream transport, time bucketing primitives, or cache orchestration.

## Common Pitfalls

### Pitfall 1: Docker ID vs internal ID mismatch in metrics ingest
**What goes wrong:** Metric writes reference non-existent `containerId` rows or silently lose data.
**Why it happens:** Agent emits Docker IDs, while `ContainerMetric.containerId` references internal UUID.
**How to avoid:** Resolve IDs at ingest and drop/log unmatched samples with counters.
**Warning signs:** Empty history for active containers, foreign key insert errors, alert engine never finding recent metrics.

### Pitfall 2: Network trend misread from cumulative counters
**What goes wrong:** Network chart/trend looks always increasing and misleading.
**Why it happens:** Docker stats network bytes are cumulative counters, not interval rates.
**How to avoid:** Compute per-bucket deltas/rates for trends while keeping current absolute counters for diagnostics.
**Warning signs:** RX/TX values only move upward with no down/idle pattern.

### Pitfall 3: Retention says 24h but query path still returns older data
**What goes wrong:** METR-03 passes in code review but fails in production behavior.
**Why it happens:** Cleanup and query lookback rules are not validated together.
**How to avoid:** Enforce both delete policy and API lookback caps; add conformance tests.
**Warning signs:** Data older than 24h appears in 24h window calls.

### Pitfall 4: Live stream floods clients during fleet-level view
**What goes wrong:** UI becomes noisy/laggy with many containers.
**Why it happens:** Per-sample fan-out with no Top N reduction or server-side aggregation.
**How to avoid:** Keep server-side aggregate + top contributors payload and throttle frame cadence.
**Warning signs:** Browser CPU spikes, dropped websocket frames, delayed control response.

### Pitfall 5: Missing/stale data state is ambiguous
**What goes wrong:** Operators cannot tell "idle" vs "disconnected" vs "paused".
**Why it happens:** No explicit freshness model in card states.
**How to avoid:** Add freshness thresholds and explicit badges (`Live`, `Stale`, `No data`, `Paused`).
**Warning signs:** Users refresh repeatedly or misinterpret stale cards as healthy.

## Code Examples

Verified patterns from official sources and repository:

### Docker CPU/Memory formula compatibility
```text
// Source: Docker Engine API v1.51 (/containers/{id}/stats)
cpu_delta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage
system_cpu_delta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage
cpu_percent = (cpu_delta / system_cpu_delta) * number_cpus * 100.0

used_memory (cgroup v1) = memory_stats.usage - memory_stats.stats.cache
used_memory (cgroup v2) = memory_stats.usage - memory_stats.stats.inactive_file
```

### Safe raw SQL bucketing from Prisma
```typescript
// Source: Prisma raw query docs
const points = await prisma.$queryRaw<{ bucket: Date; cpu_avg: number }[]>`
  SELECT date_trunc('minute', "timestamp") AS bucket,
         avg("cpuUsagePercent") AS cpu_avg
  FROM "ContainerMetric"
  WHERE "containerId" = ${containerId}
    AND "timestamp" >= ${windowStart}
  GROUP BY bucket
  ORDER BY bucket
`;
```

### Existing websocket relay baseline
```typescript
// Source: apps/api/src/websocket/server.ts
if (payload.type === 'metrics') {
  saveMetricsBatch(hostId, payload.metrics).catch(console.error);
  webClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data.toString());
    }
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Container-detail chart page as primary telemetry view | Fleet-level first, KPI-card-first live telemetry | Locked in Phase 5 context (2026-03-04) | Changes focus from deep single-container page to operational fleet scan speed. |
| Poll-first metric refresh | Streaming-first with explicit pause/resume + speed controls | Locked in Phase 5 context (2026-03-04) | Improves responsiveness; requires robust stale-state and frame-throttling design. |
| Unqualified trend extraction | Explicit window presets (15m/1h/6h/24h) with server-side bucketing | METR-02 requirement | Prevents inconsistent client calculations and supports predictable trend UX. |

**Deprecated/outdated for this phase:**
- Chart-first telemetry as default layout.
- Per-container-only entry as primary flow.
- Treating restart indicator as log/action concern (it is required KPI now).

## Open Questions

1. **What is the exact Top N default?**
   - What we know: Locked decision requires Top N active containers.
   - What's unclear: Concrete N value and tie-break behavior.
   - Recommendation: Default to `N=5`, sort by CPU descending, tie-break by memory percent.

2. **How should speed presets map to render cadence?**
   - What we know: Pause/Resume + speed presets are locked.
   - What's unclear: Whether presets change ingest cadence, UI render cadence, or both.
   - Recommendation: Keep ingest unchanged; apply presets to client render/throttle intervals only.

3. **What freshness thresholds define stale/missing?**
   - What we know: stale/missing wording and visuals are discretionary.
   - What's unclear: threshold values and status text.
   - Recommendation: `stale >= 15s without frame`, `no data >= 60s`, with explicit badges.

4. **How should history windows interact with paused live mode?**
   - What we know: both controls are required.
   - What's unclear: if changing window while paused updates card trend immediately.
   - Recommendation: Window switch always updates historical trend; pause only freezes live value updates.

## Sources

### Primary (HIGH confidence)
- Repository code: `apps/api/src/websocket/server.ts`, `apps/api/src/services/metrics.ts`, `apps/api/src/services/alertEngine.ts`, `apps/api/src/routes/hosts.ts`.
- Repository data model: `prisma/schema.prisma`.
- Repository agent metric producer: `packages/agent/docker/client.go`, `packages/agent/client/websocket.go`, `packages/agent/main.go`.
- Phase constraints: `.planning/phases/05-metrics-telemetry-core/05-CONTEXT.md`.
- Requirement mapping: `.planning/REQUIREMENTS.md`.
- Docker Engine API (official): `https://docs.docker.com/reference/api/engine/version/v1.51.yaml` (`/containers/{id}/stats` formulas and stream params).
- Docker CLI stats docs (official): `https://docs.docker.com/reference/cli/docker/container/stats/`.
- PostgreSQL datetime functions (official): `https://www.postgresql.org/docs/current/functions-datetime.html` (`date_trunc`, `date_bin`).
- Prisma docs (official):
  - CRUD + `createMany` + `skipDuplicates`: `https://www.prisma.io/docs/orm/prisma-client/queries/crud`
  - Aggregation/grouping: `https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing`
  - Raw SQL methods: `https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries`
- TanStack Query defaults (official): `https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults`
- ws package docs (official): `https://www.npmjs.com/package/ws`

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified from repository manifests and official library docs.
- Architecture: MEDIUM-HIGH - locked UX decisions are clear; final route/subscription shape still needs implementation choices.
- Pitfalls: HIGH - most are directly observable in current code boundaries and official API semantics.

**What might I have missed?**
- A dedicated existing metrics history API may exist outside `apps/api/src` (not found in current scoped search).
- Production deployment fan-out topology (single instance vs multi-instance ws gateway) is not documented in phase context and affects scaling details.

**Research date:** 2026-03-04  
**Valid until:** 2026-04-03
