---
status: investigating
trigger: "fleet-resource-chart-not-showing-data"
created: 2026-03-24T00:00:00.000Z
updated: 2026-03-24T00:00:00.000Z
---

## Current Focus

hypothesis: Hosts don't have agentApiKey configured, so useFleetMetrics hook can't authenticate with agents
test: Examine how hosts are passed from DashboardPage to FleetResourceChart, check if agentApiKey is included
expecting: Find that hosts are missing agentApiKey property
next_action: Read DashboardPage.tsx to see how hosts are passed to FleetResourceChart

## Symptoms

expected: Chart should show real-time CPU/memory data from all fleet hosts
actual: Chart shows no data / is empty / displays fallback mock data
errors: None reported
reproduction: Open dashboard, look at Fleet Resource Trends chart
started: After adding real-time polling code

## Eliminated

## Evidence
