# Graph Report - src/components/admin  (2026-05-12)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 23 nodes · 56 edges · 4 communities (3 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]

## God Nodes (most connected - your core abstractions)
1. `formatDate()` - 11 edges
2. `StatusPill()` - 8 edges
3. `filterByQuery()` - 7 edges
4. `DetailField()` - 4 edges
5. `AdminActionDialog()` - 4 edges
6. `AdminOrganizationManagement()` - 3 edges
7. `AdminUserManagement()` - 3 edges
8. `AdminBillingManagement()` - 2 edges
9. `AdminHostManagement()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `AdminBillingManagement()` --calls--> `formatDate()`  [EXTRACTED]
  src/components/admin/AdminBillingManagement.tsx → src/components/admin/admin-utils.ts
- `AdminOrganizationManagement()` --calls--> `formatDate()`  [EXTRACTED]
  src/components/admin/AdminOrganizationManagement.tsx → src/components/admin/admin-utils.ts
- `AdminHostManagement()` --calls--> `filterByQuery()`  [EXTRACTED]
  src/components/admin/AdminHostManagement.tsx → src/components/admin/admin-utils.ts
- `AdminUserManagement()` --calls--> `filterByQuery()`  [EXTRACTED]
  src/components/admin/AdminUserManagement.tsx → src/components/admin/admin-utils.ts
- `AdminUserManagement()` --calls--> `formatDate()`  [EXTRACTED]
  src/components/admin/AdminUserManagement.tsx → src/components/admin/admin-utils.ts

## Communities (4 total, 1 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.52
Nodes (4): filterByQuery(), AdminHostManagement(), AdminOrganizationManagement(), AdminActionDialog()

### Community 2 - "Community 2"
Cohesion: 0.53
Nodes (4): formatDate(), AdminBillingManagement(), DetailField(), AdminUserManagement()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `formatDate()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `StatusPill()` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `filterByQuery()` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._