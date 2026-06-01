# Graph Report - src/pages  (2026-05-12)

## Corpus Check
- Corpus is ~33,554 words - fits in a single context window. You may not need a graph.

## Summary
- 97 nodes · 102 edges · 22 communities (17 shown, 5 thin omitted)
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
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `useOnboardingState()` - 4 edges
2. `OnboardingPage()` - 3 edges
3. `OnboardingStepRouter()` - 3 edges
4. `ErrorBanner()` - 3 edges
5. `isStep0Submitting()` - 3 edges
6. `isStep1Loading()` - 3 edges
7. `getProgressWidth()` - 3 edges
8. `ErrorBox()` - 2 edges
9. `LoadingCard()` - 2 edges
10. `StepComplete()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `OnboardingPage()` --calls--> `useOnboardingState()`  [EXTRACTED]
  OnboardingPage.tsx → onboarding/useOnboardingState.ts
- `OnboardingPage()` --calls--> `getProgressWidth()`  [EXTRACTED]
  OnboardingPage.tsx → onboarding/useOnboardingState.ts
- `OnboardingStepRouter()` --calls--> `isStep0Submitting()`  [EXTRACTED]
  OnboardingPage.tsx → onboarding/useOnboardingState.ts
- `OnboardingStepRouter()` --calls--> `isStep1Loading()`  [EXTRACTED]
  OnboardingPage.tsx → onboarding/useOnboardingState.ts

## Communities (22 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (11): LoadingCard(), Props, Props, StepComplete(), Props, StepTestFailed(), getProgressWidth(), isStep0Submitting() (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (6): ErrorBanner(), ErrorBox(), Props, StepCreateOrg(), Props, StepHostCredentials()

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (8): AuthSyncStatus, checkAuthSyncStatus(), OnboardingStep, pollForOrganizationSync(), STEPS, SyncPollingResult, useOnboardingState(), useOrganizationSyncEffect()

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (4): COMPLIANCE_OPTIONS, INTEGRATION_OPTIONS, REGION_OPTIONS, STEP_LABELS

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (4): MODE_ICONS, Props, StepHostBasics(), CONNECTION_MODES

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (3): deploymentMilestones, enterprisePlan, trustPoints

## Knowledge Gaps
- **22 isolated node(s):** `REGION_OPTIONS`, `COMPLIANCE_OPTIONS`, `INTEGRATION_OPTIONS`, `STEP_LABELS`, `enterprisePlan` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useOnboardingState()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `ErrorBanner()` connect `Community 1` to `Community 5`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `isStep0Submitting()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `REGION_OPTIONS`, `COMPLIANCE_OPTIONS`, `INTEGRATION_OPTIONS` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._