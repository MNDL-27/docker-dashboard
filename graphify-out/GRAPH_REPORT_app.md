# Graph Report - src/pages/app  (2026-05-12)

## Corpus Check
- Corpus is ~16,647 words - fits in a single context window. You may not need a graph.

## Summary
- 99 nodes · 99 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `ContainerDetailPage()` - 10 edges
2. `MonitoringPage()` - 5 edges
3. `FileViewer()` - 3 edges
4. `formatBytes()` - 2 edges
5. `formatCount()` - 2 edges
6. `calcCpuPercent()` - 2 edges
7. `calcNetworkIo()` - 2 edges
8. `calcBlkioTotal()` - 2 edges
9. `getPrimaryIp()` - 2 edges
10. `getContainerHealth()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (18 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (14): calcBlkioTotal(), calcCpuPercent(), calcNetworkIo(), ContainerAction, ContainerDetailPage(), DockerContainerInspect, DockerContainerStats, DockerPortBinding (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (8): BadgeStatus, ContainerListItem, ContainersPage(), ContainerStatsItem, formatBytes(), formatNetIO(), shortenImage(), STATE_TABS

### Community 2 - "Community 2"
Cohesion: 0.28
Nodes (4): ContainerListItem, FileViewer(), formatFileSize(), getLanguageFromPath()

### Community 3 - "Community 3"
Cohesion: 0.39
Nodes (6): formatBytes(), formatPercent(), formatSpeed(), MetricTone, MonitoringPage(), upcomingFeatures

### Community 4 - "Community 4"
Cohesion: 0.4
Nodes (3): rolloutSteps, sampleReleases, upcomingFeatures

### Community 5 - "Community 5"
Cohesion: 0.4
Nodes (3): previewHighlights, readinessSteps, sampleTimeline

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): ALL_TABS, SettingsPage(), useTabSync()

## Knowledge Gaps
- **23 isolated node(s):** `tabs`, `AdminTab`, `DockerContainerStats`, `DockerContainerInspect`, `DockerPortBinding` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `tabs`, `AdminTab`, `DockerContainerStats` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._