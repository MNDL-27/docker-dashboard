# Graph Report - src/hooks  (2026-05-12)

## Corpus Check
- Corpus is ~6,741 words - fits in a single context window. You may not need a graph.

## Summary
- 162 nodes · 215 edges · 13 communities (11 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `useAdminMutation()` - 21 edges
2. `useDestinationSettings()` - 10 edges
3. `extractMetrics()` - 6 edges
4. `normalizeFleetMetricPoint()` - 5 edges
5. `normalizeHostMetricsPoint()` - 5 edges
6. `toFiniteNumber()` - 4 edges
7. `normalizeOptionalRate()` - 4 edges
8. `reducer()` - 3 edges
9. `dispatch()` - 3 edges
10. `Toast` - 3 edges

## Surprising Connections (you probably didn't know these)
- `useDestinationSettings()` --calls--> `useToast()`  [INFERRED]
  useDestinationSettings.ts → use-toast.ts
- `useDestinationSettings()` --calls--> `useSlackDestinations()`  [INFERRED]
  useDestinationSettings.ts → useSlackDestinations.ts
- `useDestinationSettings()` --calls--> `useCreateSlackDestination()`  [INFERRED]
  useDestinationSettings.ts → useSlackDestinations.ts
- `useDestinationSettings()` --calls--> `useUpdateSlackDestination()`  [INFERRED]
  useDestinationSettings.ts → useSlackDestinations.ts
- `useDestinationSettings()` --calls--> `useTestSlackDestination()`  [INFERRED]
  useDestinationSettings.ts → useSlackDestinations.ts

## Communities (13 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (22): adminQueryOptions, useAddAdminOrgBan(), useAdminMatchBillingEvent(), useAdminMutation(), useAdminResendDonorEmailDelivery(), useApproveAdminUser(), useCreateAdminNotification(), useDeleteAdminNotification() (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (23): clamp(), extractMetrics(), formatFailureDetails(), formatTimeLabel(), getHostMetricsFailure(), HostMetricsApiDisk, HostMetricsApiPoint, HostMetricsDisk (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (9): ContainerHostRef, ContainerLogOptions, HostMutationBase, HostSecrets, useContainers(), useDockerHosts(), useViewerState(), ViewerEntitlements (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (11): useToast(), TestResult, useDestinationSettings(), useCreateSlackDestination(), useSlackDestinations(), useTestSlackDestination(), useUpdateSlackDestination(), useCreateWebhookDestination() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (13): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (7): FleetMetrics, FleetMetricsApiPoint, formatTimeLabel(), normalizeFleetMetricPoint(), normalizeOptionalRate(), toFiniteNumber(), toTimestamp()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (3): AuthMeState, initialState, unauthenticatedState

## Knowledge Gaps
- **32 isolated node(s):** `ToasterToast`, `actionTypes`, `ActionType`, `Action`, `State` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 9 inferred relationships involving `useDestinationSettings()` (e.g. with `useToast()` and `useSlackDestinations()`) actually correct?**
  _`useDestinationSettings()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ToasterToast`, `actionTypes`, `ActionType` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._