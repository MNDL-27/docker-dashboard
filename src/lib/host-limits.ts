import type { DockerHost } from "@/types/database";
import type { ViewerState } from "@/hooks/useViewerState";
import { normalizePlan, PLAN_POLICY_BY_PLAN } from "../../shared/schema/plan-policy";

/**
 * Shared utility for enforcing and calculating host-related limits on the frontend.
 * This centralizes logic that was previously duplicated in:
 * - src/hooks/useDocker.ts
 * - src/hooks/useHostWorkspaceState.ts
 * - src/components/hosts/HostWorkspace.tsx
 */

/**
 * Resolves the effective node limit for the current viewer context.
 * Prioritizes actual entitlements from the server, falling back to static policy.
 */
export function resolveNodeLimit(viewer: ViewerState | null | undefined): number | null {
  const entitlements = viewer?.entitlements;
  
  // If we have hydrated entitlements from /auth/me, that's the source of truth.
  if (entitlements) {
    return entitlements.nodeLimit;
  }

  // Fallback to static plan policy if entitlements haven't loaded yet.
  const activePlan = normalizePlan(viewer?.active_org_effective_plan ?? viewer?.active_org_plan);
  return PLAN_POLICY_BY_PLAN[activePlan].nodeLimit;
}

/**
 * Standardized sorting for hosts by creation date (oldest first).
 * This order matches the backend's deactivation logic.
 */
export function sortHostsByCreation(hosts: DockerHost[]): DockerHost[] {
  return [...hosts].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime() || 0;
    const dateB = new Date(b.created_at).getTime() || 0;
    return dateA - dateB || a.id.localeCompare(b.id);
  });
}

/**
 * Calculates which host IDs are allowed under the current plan.
 * Returns null if the plan has no host limit.
 */
export function getAllowedHostIds(hosts: DockerHost[], nodeLimit: number | null): Set<string> | null {
  if (nodeLimit === null) return null;
  
  const sorted = sortHostsByCreation(hosts);
  const allowed = new Set<string>();
  
  for (let i = 0; i < Math.min(nodeLimit, sorted.length); i++) {
    allowed.add(sorted[i].id);
  }
  
  return allowed;
}

/**
 * Checks if a specific host is locked (exceeds plan limit).
 */
export function isHostLocked(hostId: string, allowedHostIds: Set<string> | null): boolean {
  if (allowedHostIds === null) return false;
  return !allowedHostIds.has(hostId);
}

/**
 * Returns a human-readable reason why adding a host is disabled, if applicable.
 */
export function buildAddHostDisabledReason(hostCount: number, nodeLimit: number | null): string | undefined {
  if (nodeLimit === null || hostCount < nodeLimit) return undefined;
  return `Your plan allows up to ${nodeLimit} connected host(s). Upgrade to add more.`;
}
