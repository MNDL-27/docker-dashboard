# Phase 4: Fleet Inventory Views - Research

**Researched:** 2026-03-04  
**Domain:** Fleet inventory UI/API (host cards, container cards, scoped filtering/search)  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Claude's Discretion
- Host cards feel like "issue cards in Linear" — clean, not cluttered
- Expand animation should be smooth, not jarring
- Status colors: Green (running), Red (stopped), Yellow (restarting), Gray (unknown)
- User density preference persists across sessions

### Deferred Ideas (OUT OF SCOPE)
- Container detail page (full view with all metadata) — Phase 7 or later
- Metrics on container cards — Phase 5 (Metrics Telemetry Core)
- Live log tail from container cards — Phase 6 (Live Logs)
- Container actions (start/stop/restart) from cards — Phase 7 (Safe Container Actions)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INVT-01 | User can view fleet-level host and container counts. | Reuse `GET /hosts` + container relation counts, add fleet aggregate response for selected scope (org/project/filter) and return totals alongside host cards. |
| INVT-02 | User can view containers for a selected host with status, image, labels, and restart count. | Reuse `GET /hosts/:id/containers`, extend container model + agent snapshot to include restart count and remaining locked card fields (created/networks/volumes), keep tenant scope via `scopedContainerWhere`. |
| INVT-03 | User can filter/search host container lists. | Add explicit API query contract for search + multi-select filters (status/project/host), implement draft/apply filter UX state, and test scoped filtering semantics. |
</phase_requirements>

## Summary

The repository already has a usable baseline for Phase 4: tenant-scoped host listing and host container listing endpoints (`apps/api/src/routes/hosts.ts`), host/container persistence (`prisma/schema.prisma`), and a fleet UI surface in Next.js (`apps/web/src/app/(dashboard)/fleet/page.tsx`, `apps/web/src/components/fleet/HostList.tsx`, `apps/web/src/components/fleet/ContainerTable.tsx`).

The main work is not greenfield UI, but restructuring and enriching existing data/model surfaces to match locked decisions: table/detail routes become drill-down cards with inline expansion, and container filtering/search needs an Apply-driven workflow with multi-select filters. Several required fields are currently missing in persisted host/container snapshots (notably host IP/agent version/CPU-memory summary and container restart count/networks/volumes/true created time), so Phase 4 planning should include schema + agent ingest expansion before UI polish.

**Primary recommendation:** Keep existing `hosts` and scoped-access architecture, add one inventory-focused API query contract plus snapshot field extensions, then implement a single `/fleet` drill-down card experience with persisted density + Apply-based filters.

## Existing Relevant Reuse

### Web
| File | What exists | Reuse strategy |
|------|-------------|----------------|
| `apps/web/src/app/(dashboard)/fleet/page.tsx` | Fleet dashboard shell, org selection, host section mountpoint | Keep as Phase 4 route root; replace table-centric composition with card drill-down composition. |
| `apps/web/src/components/fleet/HostList.tsx` | Polling host fetch + empty state + status mapping | Refactor into `FleetInventoryView` with host-card renderer and expanded container pane under selected host. |
| `apps/web/src/components/fleet/ContainerTable.tsx` | Local search/status filtering logic | Reuse filter predicate semantics, but move to card grid + draft/applied state and API-driven filter params. |
| `apps/web/src/lib/api.ts` | `apiFetch`, org persistence in localStorage | Reuse storage helpers for density preference persistence and request plumbing. |

### API
| File | What exists | Reuse strategy |
|------|-------------|----------------|
| `apps/api/src/routes/hosts.ts` | `GET /hosts`, `GET /hosts/:id`, `GET /hosts/:id/containers` with tenant scope checks | Keep as main inventory backbone; add filter/search query support and aggregate counts payload shape. |
| `apps/api/src/services/scopedAccess.ts` | `resolveUserScope`, `scopedHostWhere`, `scopedContainerWhere` | Reuse unchanged for INVT queries; avoid custom scoping logic in new routes. |
| `apps/api/src/services/presence.ts` | canonical host ONLINE/OFFLINE derivation from heartbeat freshness | Reuse for host card status/last seen; do not duplicate host freshness logic in UI. |
| `apps/api/src/services/container.ts` | container snapshot sync transaction | Extend payload + upsert mapping for missing Phase 4 card fields. |

### Agent Ingest
| File | What exists | Gap relevance |
|------|-------------|---------------|
| `packages/agent/docker/client.go` | Sends container `name/image/state/status/ports/labels/startedAt` | Missing restart count, created timestamp from inspect, networks, volumes. |
| `packages/agent/client/api.go` | Posts snapshots to `/api/agent/containers` | Existing payload schema must be extended when new container fields are added. |

## Data Sources (Available vs Gaps)

### Currently available (HIGH)
- Host: `name`, `hostname`, `os`, `architecture`, `dockerVersion`, `status`, `lastSeen`, container count (`_count.containers`) from `GET /hosts`.
- Container: `name`, `image`, `state`, `status`, `ports` (JSON), `labels` (JSON), `startedAt`, `dockerId` from `GET /hosts/:id/containers`.
- Scope: organization/project constraints are already enforced via `resolveUserScope` and scoped where helpers.

### Missing for locked decisions (HIGH)
- Host card fields missing in schema/ingest: `ipAddress`, `agentVersion`, host CPU/memory summary.
- Container card fields missing in schema/ingest: explicit `restartCount`, canonical container `createdAt` (Docker creation time), `networks`, `volumes`.
- Multi-select filter/search contract is not in API (current filtering is local/UI and limited).
- Density preference is not implemented yet (only org selection persistence currently exists).

### Notable compatibility risk (MEDIUM)
- Agent client posts to `/api/agent/*` in Go client while API server mounts `/agent/*` routes. Validate current runtime path behavior before planning depends on fresh ingest for inventory cards.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js + React | `next@^15.3.0`, `react@^19.0.0` | Fleet inventory UI route and interactive drill-down state | Existing app stack and route organization are already in this model. |
| Express | `^4.18.2` | Inventory query endpoints | Existing API route surface for hosts/containers. |
| Prisma | `@prisma/client@^7.4.1` | Host/container snapshot persistence and scoped queries | Existing schema + query patterns already implemented. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query | `^5.64.0` | Cache host/container queries and refetch on Apply/expand | Use for applied filter transitions and host expansion fetches. |
| Vitest + Supertest | `vitest@^4.0.18`, `supertest@^7.2.2` | API contract and scope regression tests | Use for INVT filtering, counts, and tenant isolation tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline host expand on `/fleet` | Separate `/fleet/[hostId]` detail route | Existing detail route exists, but violates locked drill-down-inline interaction. |
| Apply-based filters (draft + commit) | Live filtering on every keystroke/toggle | Simpler implementation, but violates locked decision and can trigger noisy API churn. |

**Installation:**
```bash
npm --prefix apps/web install
npm --prefix apps/api install
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/web/src/
├── app/(dashboard)/fleet/page.tsx          # Fleet page container
├── components/fleet/FleetInventoryView.tsx # host cards + expand panel + filters
├── components/fleet/HostCard.tsx           # density-aware host card
├── components/fleet/ContainerCardGrid.tsx  # density-aware container cards
└── components/fleet/FleetFilters.tsx       # draft/apply filter UI

apps/api/src/
├── routes/hosts.ts                         # extend query contract
├── services/scopedAccess.ts                # scope enforcement reuse
└── services/container.ts                   # expanded snapshot field ingest
```

### Pattern 1: Draft vs Applied Filters
**What:** Keep filter edits in draft state; fetch/filter data only when Apply is pressed.
**When to use:** Search + multi-select status/project/host UX.
**Example:**
```typescript
// Source: repository pattern from apps/web/src/components/fleet/ContainerTable.tsx + locked decision
const [draftFilters, setDraftFilters] = useState(defaults);
const [appliedFilters, setAppliedFilters] = useState(defaults);

function onApply() {
  setAppliedFilters(draftFilters);
}
```

### Pattern 2: Scoped API Filtering (No Client-Only Security Filter)
**What:** Apply org/project and optional filter criteria in Prisma query.
**When to use:** Host containers list query with search and multi-selects.
**Example:**
```typescript
// Source: apps/api/src/routes/hosts.ts + apps/api/src/services/scopedAccess.ts
const containers = await prisma.container.findMany({
  where: scopedContainerWhere(scope, {
    hostId,
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }] } : {}),
  }),
  orderBy: { name: 'asc' },
});
```

### Pattern 3: Host Drill-Down Inline Expansion
**What:** Single selected host card expands container grid directly below list (same page context).
**When to use:** `/fleet` primary interaction model.
**Example:**
```tsx
// Source: locked decision for Phase 4
{hosts.map((host) => (
  <Fragment key={host.id}>
    <HostCard host={host} onClick={() => setExpandedHostId(host.id)} />
    {expandedHostId === host.id && <ContainerCardGrid hostId={host.id} />}
  </Fragment>
))}
```

### Anti-Patterns to Avoid
- **Keeping `/fleet/[hostId]` as primary inventory flow:** conflicts with locked inline drill-down behavior.
- **Live-filtering every field change:** conflicts with Apply requirement and can thrash fetches.
- **Client-only scope filtering:** leaks data risk; scope must remain in API queries.
- **Packing Phase 5/6/7 into cards:** metrics/logs/actions are explicitly deferred.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant scoping | ad-hoc org/project checks per route | `resolveUserScope`, `scopedHostWhere`, `scopedContainerWhere` | Existing centralized boundary logic is already regression-tested. |
| Container ingest merge logic | custom per-endpoint diff code | `syncContainers` transaction pattern | Existing add/update/remove transaction handles snapshot lifecycle. |
| Query caching orchestration | custom fetch cache/event bus | TanStack Query | Already configured provider in app root; supports stale/refetch semantics cleanly. |
| Restart count extraction edge cases | brittle UI regex only | persisted numeric field from agent inspect data | Prevents display drift and avoids repeated parsing hacks. |

**Key insight:** The risky part of Phase 4 is data shape completeness, not rendering cards. Solve snapshot/schema gaps first so UI work does not get rewritten.

## Common Pitfalls

### Pitfall 1: Designing UI before snapshot fields exist
**What goes wrong:** Cards are built, then schema/ingest changes force refactors.
**Why it happens:** Required fields (restart count/networks/volumes/host IP/version/resources) are not currently persisted.
**How to avoid:** Make a data-contract-first subtask (schema + agent payload + API response) before card implementation.
**Warning signs:** Placeholder fields, regex-derived pseudo-values, or TODO-heavy card rendering.

### Pitfall 2: Scope regressions from richer filters
**What goes wrong:** Cross-project/tenant data leaks when combining host/project filters.
**Why it happens:** New filter clauses bypass existing `scoped*Where` helpers.
**How to avoid:** Always compose filter conditions inside `scopedHostWhere/scopedContainerWhere`.
**Warning signs:** tests pass for single project but fail for mismatched projectId queries.

### Pitfall 3: Apply UX implemented as live filtering
**What goes wrong:** Every draft edit triggers list churn and expensive requests.
**Why it happens:** Single state object drives both form controls and query params.
**How to avoid:** Separate `draftFilters` and `appliedFilters`; fetch on Apply only.
**Warning signs:** network calls on each keypress/toggle.

### Pitfall 4: Mixing deferred features into Phase 4
**What goes wrong:** Scope creep into metrics/logs/actions/detail route.
**Why it happens:** Existing `/fleet/[hostId]/[containerId]` page can tempt reuse.
**How to avoid:** Keep container cards informational only; no actions, no live telemetry, no deep-detail navigation requirement.
**Warning signs:** Phase branch introduces websocket/metrics/log dependencies for fleet cards.

### Tests to include (recommended)
- API: `GET /hosts` returns host + container totals by scope (INVT-01).
- API: `GET /hosts/:id/containers` supports search across name/image/labels and status/project/host multi-select semantics (INVT-02/03).
- API: tenant isolation regression for new filter params (cross-org and cross-project denial).
- UI: Apply button behavior (draft edits do not mutate results until Apply).
- UI: empty states for no hosts, no containers for expanded host, and no results message.

## Code Examples

Verified patterns from existing repository:

### Scoped host query with container count
```typescript
// Source: apps/api/src/routes/hosts.ts
const hosts = await prisma.host.findMany({
  where: scopedHostWhere(scope),
  include: {
    project: { select: { id: true, name: true } },
    _count: { select: { containers: true } },
  },
  orderBy: { name: 'asc' },
});
```

### Container snapshot sync transaction
```typescript
// Source: apps/api/src/services/container.ts
const existing = await tx.container.findMany({ where: { hostId }, select: { id: true, dockerId: true } });
// delete removed + upsert incoming in same transaction
```

### Presence normalization for host cards
```typescript
// Source: apps/api/src/services/presence.ts
const isFresh = now.getTime() - lastSeen.getTime() <= HOST_ONLINE_THRESHOLD_MS;
return { status: isFresh ? 'ONLINE' : 'OFFLINE', lastSeen };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Table + separate host detail route (`/fleet/[hostId]`) | Locked inline drill-down on `/fleet` with host cards | Phase 4 context (2026-03-03) | Requires UI composition shift and likely de-emphasis of host-detail page for inventory. |
| Minimal container snapshot fields | Rich card data contract (restart/created/networks/volumes) | Required by Phase 4 locked decisions | Requires schema + agent payload expansion before UI parity is possible. |

**Deprecated/outdated for this phase:**
- Using `ContainerTable` as the primary inventory visualization.
- Relying on container detail route for core Phase 4 visibility workflows.

## Suggested Plan Decomposition Candidates

1. **Inventory data contract + API extension**
   - Extend Prisma `Host`/`Container` fields needed for locked cards.
   - Extend agent snapshot collection + sync mapping.
   - Add/extend inventory query params for search + multi-select filters + aggregate counts.

2. **Fleet drill-down UI rewrite**
   - Refactor `/fleet` to host card grid + inline expand container card grid.
   - Implement contextual Filter panel with draft/apply behavior.
   - Implement density modes (Simple/Standard/Detailed) default Detailed + local persistence.

3. **Hardening + empty-state/tutorial polish**
   - Add empty-state variants and guided mini tutorial affordances.
   - Add API regression tests (scope/filter/counts) and UI interaction checks.
   - Validate deferred features remain out of scope.

## Open Questions

1. **Where should host IP come from (agent-reported LAN IP vs API-observed source IP)?**
   - What we know: Locked host card requires IP; schema currently lacks IP field.
   - What's unclear: authoritative IP source and privacy expectations.
   - Recommendation: use explicit agent-reported IP field; avoid relying on request source IP as primary display value.

2. **Should full search/filter execute server-side only, or hybrid local for expanded host subset?**
   - What we know: locked decisions require full search + multi-select + Apply behavior.
   - What's unclear: expected dataset size and response-time target.
   - Recommendation: default to server-side filtering contract for correctness and scale; optionally local post-filter small expanded host subsets.

3. **Agent endpoint prefix mismatch (`/api/agent/*` vs `/agent/*`)—already handled elsewhere or latent bug?**
   - What we know: code paths disagree between Go agent client and Express route mounts.
   - What's unclear: whether deployment path rewriting compensates.
   - Recommendation: verify/fix before Phase 4 depends on ingest freshness.

## Sources

### Primary (HIGH confidence)
- Repository code: `apps/web/src/app/(dashboard)/fleet/page.tsx`, `apps/web/src/components/fleet/HostList.tsx`, `apps/web/src/components/fleet/ContainerTable.tsx`.
- Repository code: `apps/api/src/routes/hosts.ts`, `apps/api/src/services/scopedAccess.ts`, `apps/api/src/services/presence.ts`, `apps/api/src/services/container.ts`.
- Repository schema: `prisma/schema.prisma`.
- Agent ingest code: `packages/agent/main.go`, `packages/agent/docker/client.go`, `packages/agent/client/api.go`.
- Requirement and context docs: `.planning/REQUIREMENTS.md`, `.planning/phases/04-fleet-inventory-views/04-CONTEXT.md`.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly derived from repository package manifests and active code paths.
- Architecture: MEDIUM - target UI/endpoint composition is clear, but final API shape depends on unresolved data gaps.
- Pitfalls: HIGH - observed directly in current code/data contract boundaries.

**Research date:** 2026-03-04  
**Valid until:** 2026-04-03
