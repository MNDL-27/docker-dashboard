# Graph Report - src/components/hosts  (2026-05-12)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 54 nodes · 84 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `HostWorkspace()` - 6 edges
2. `AgentUpdateDialog()` - 5 edges
3. `formatBytes()` - 5 edges
4. `HostDetailHeader()` - 4 edges
5. `formatSpeed()` - 4 edges
6. `buildAddHostDisabledReason()` - 3 edges
7. `buildPingToastDescription()` - 3 edges
8. `buildMetricsErrorMessage()` - 3 edges
9. `resolveAgentUpdateCopy()` - 3 edges
10. `agentVerificationReason()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `HostWorkspace()` --calls--> `resolveAgentUpdateCopy()`  [EXTRACTED]
  src/components/hosts/HostWorkspace.tsx → src/components/hosts/host-workspace-helpers.ts
- `HostWorkspace()` --calls--> `agentVerificationReason()`  [EXTRACTED]
  src/components/hosts/HostWorkspace.tsx → src/components/hosts/host-workspace-helpers.ts
- `HostWorkspace()` --calls--> `buildAddHostDisabledReason()`  [EXTRACTED]
  src/components/hosts/HostWorkspace.tsx → src/components/hosts/host-workspace-helpers.ts
- `HostWorkspace()` --calls--> `buildMetricsErrorMessage()`  [EXTRACTED]
  src/components/hosts/HostWorkspace.tsx → src/components/hosts/host-workspace-helpers.ts
- `HostWorkspace()` --calls--> `formatHostMetricsFailure()`  [EXTRACTED]
  src/components/hosts/HostWorkspace.tsx → src/components/hosts/host-workspace-helpers.ts

## Communities (8 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (3): HostMetricsGridProps, MetricsState, MetricsVariant

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (7): AgentUpdateDialog(), statusSummaryTone(), statusTone(), formatLastSeen(), formatUptime(), HostDetailHeader(), HostDetailHeaderProps

### Community 2 - "Community 2"
Cohesion: 0.4
Nodes (5): buildAgentVersionLine(), buildPingToastDescription(), isRunningContainer(), PingResult, resolveAgentUpdateCopy()

### Community 3 - "Community 3"
Cohesion: 0.5
Nodes (3): HostCard(), HostSidebar(), HostSidebarProps

### Community 4 - "Community 4"
Cohesion: 0.4
Nodes (4): HostMetricsGrid(), resolveMetricsVariant(), SelectedHostView(), SelectedHostViewProps

### Community 5 - "Community 5"
Cohesion: 0.6
Nodes (5): DiskUsageCard(), formatBytes(), formatSpeed(), MemoryPanel(), NetworkPanel()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): buildAddHostDisabledReason(), buildMetricsErrorMessage(), formatHostMetricsFailure(), HostWorkspace()

## Knowledge Gaps
- **7 isolated node(s):** `PingResult`, `HostDetailHeaderProps`, `MetricsState`, `MetricsVariant`, `HostMetricsGridProps` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SelectedHostView()` connect `Community 4` to `Community 6`?**
  _High betweenness centrality (0.469) - this node is a cross-community bridge._
- **Why does `HostDetailHeader()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `AgentUpdateDialog()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `PingResult`, `HostDetailHeaderProps`, `MetricsState` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._