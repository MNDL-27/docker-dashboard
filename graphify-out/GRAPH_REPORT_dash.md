# Graph Report - src/components/dashboard  (2026-05-12)

## Corpus Check
- Corpus is ~2,891 words - fits in a single context window. You may not need a graph.

## Summary
- 40 nodes · 48 edges · 10 communities (5 shown, 5 thin omitted)
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
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `FleetResourceTooltip()` - 4 edges
2. `formatSpeed()` - 3 edges
3. `FleetResourceChart()` - 3 edges
4. `ContainersTable()` - 2 edges
5. `AlertItem` - 2 edges
6. `DashboardContainerSummary` - 2 edges
7. `DashboardAlerts()` - 2 edges
8. `buildInitialFleetData()` - 2 edges
9. `formatBytes()` - 2 edges
10. `formatPercentage()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `FleetResourceTooltip()` --calls--> `formatSpeed()`  [EXTRACTED]
  src/components/dashboard/FleetResourceChart.tsx → src/components/dashboard/FleetResourceChart.tsx  _Bridges community 9 → community 5_

## Communities (10 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.28
Nodes (6): ContainersTable(), ContainersTableProps, AlertItem, DashboardContainerSummary, DashboardAlerts(), DashboardAlertsProps

### Community 1 - "Community 1"
Cohesion: 0.33
Nodes (4): buildInitialFleetData(), CompactMetricProps, FleetResourceChartProps, FleetResourceTooltipProps

### Community 2 - "Community 2"
Cohesion: 0.4
Nodes (3): HostHealthGrid(), HostHealthGridProps, STATUS_LABEL

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (3): FleetResourceTooltip(), formatBytes(), formatPercentage()

## Knowledge Gaps
- **11 isolated node(s):** `ContainersTableProps`, `DashboardAlertsProps`, `DashboardEmptyHostsStateProps`, `DashboardLoadingStateProps`, `DashboardOverviewProps` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FleetResourceChart()` connect `Community 9` to `Community 1`, `Community 6`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `formatSpeed()` connect `Community 9` to `Community 1`, `Community 5`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `FleetResourceTooltip()` connect `Community 5` to `Community 1`, `Community 9`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `ContainersTableProps`, `DashboardAlertsProps`, `DashboardEmptyHostsStateProps` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._